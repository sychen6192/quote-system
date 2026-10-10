import { NextRequest } from "next/server";
import { createDeviceToken, verifyDeviceToken, verifySessionToken } from "@/lib/auth/session";

const ORIGINAL = { ...process.env };
const BASE = "http://localhost:3000";

type LoginRoute = typeof import("@/app/api/auth/login/route");
type LogoutRoute = typeof import("@/app/api/auth/logout/route");

// Fresh module per test: the login throttle is module-level state.
function loadRoutes(): { login: LoginRoute; logout: LogoutRoute } {
  let login!: LoginRoute;
  let logout!: LogoutRoute;
  jest.isolateModules(() => {
    login = jest.requireActual("@/app/api/auth/login/route");
    logout = jest.requireActual("@/app/api/auth/logout/route");
  });
  return { login, logout };
}

function post(
  path: string,
  fields: Record<string, string>,
  headers: Record<string, string> = { origin: BASE }
): NextRequest {
  return new NextRequest(`${BASE}${path}`, {
    method: "POST",
    body: new URLSearchParams(fields),
    headers: { host: "localhost:3000", "content-type": "application/x-www-form-urlencoded", ...headers },
  });
}

function setCookie(res: Response): string {
  return res.headers.get("set-cookie") ?? "";
}

function cookieValue(res: Response, name: string): string | undefined {
  for (const c of res.headers.getSetCookie()) {
    const m = new RegExp(`^${name}=([^;]*)`).exec(c);
    if (m) return m[1];
  }
  return undefined;
}

async function fillOverallCap(login: LoginRoute) {
  for (let i = 0; i < 30; i++) {
    const res = await login.POST(
      post("/api/auth/login", { password: "x", locale: "en" }, { origin: BASE, "x-forwarded-for": `10.0.0.${i}` })
    );
    expect(res.headers.get("location")).toMatch(/error=invalid/);
  }
}

beforeEach(() => {
  process.env.APP_PASSWORD = "s3cret";
  process.env.AUTH_SECRET = "0123456789abcdef0123456789abcdef";
});
afterAll(() => {
  process.env = ORIGINAL;
});

describe("POST /api/auth/login", () => {
  it("signs in: 303 to the relative next path with the session cookie", async () => {
    const { login } = loadRoutes();
    const res = await login.POST(
      post("/api/auth/login", { password: "s3cret", locale: "en", next: "/en/quotes?status=sent" })
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/en/quotes?status=sent");

    const cookie = setCookie(res);
    expect(cookie).toMatch(/^qs_session=v1\.\d+\.[A-Za-z0-9_-]{43};/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=2592000/);
    expect(cookie).not.toMatch(/Secure/i);

    const token = /^qs_session=([^;]+)/.exec(cookie)![1];
    expect(await verifySessionToken(token)).toBe(true);
  });

  it("marks the cookie Secure behind an HTTPS proxy", async () => {
    const { login } = loadRoutes();
    const res = await login.POST(
      post(
        "/api/auth/login",
        { password: "s3cret" },
        { origin: "https://q.example", "x-forwarded-host": "q.example", "x-forwarded-proto": "https" }
      )
    );
    expect(res.status).toBe(303);
    expect(setCookie(res)).toMatch(/Secure/i);
  });

  it("rejects cross-origin posts with 403 and no cookie", async () => {
    const { login } = loadRoutes();
    const res = await login.POST(post("/api/auth/login", { password: "s3cret" }, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(setCookie(res)).toBe("");
  });

  it("sends a wrong password back to the login page", async () => {
    const { login } = loadRoutes();
    const res = await login.POST(
      post("/api/auth/login", { password: "nope", locale: "zh-TW", next: "/zh-TW/quotes" })
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/zh-TW/login?error=invalid&next=%2Fzh-TW%2Fquotes");
    expect(setCookie(res)).toBe("");
  });

  it("refuses open redirects", async () => {
    const { login } = loadRoutes();
    for (const next of [
      "//evil.example/x",
      "https://evil.example",
      "/\\evil.example",
      "/.//evil.example/x",
      "/a/..//evil.example",
      "/%2e//evil.example",
    ]) {
      const res = await login.POST(post("/api/auth/login", { password: "s3cret", locale: "en", next }));
      expect(res.headers.get("location")).toBe("/en");
    }
  });

  it("takes the locale from next when the form has none", async () => {
    const { login } = loadRoutes();
    const res = await login.POST(post("/api/auth/login", { password: "nope", next: "/zh-TW/quotes" }));
    expect(res.headers.get("location")).toMatch(/^\/zh-TW\/login\?/);
  });

  it("throttles after 5 failures per IP, even for the right password", async () => {
    const { login } = loadRoutes();
    const attacker = { origin: BASE, "x-forwarded-for": "203.0.113.9" };
    for (let i = 0; i < 5; i++) {
      const res = await login.POST(post("/api/auth/login", { password: `guess${i}`, locale: "en" }, attacker));
      expect(res.headers.get("location")).toMatch(/error=invalid/);
    }
    const blocked = await login.POST(post("/api/auth/login", { password: "s3cret", locale: "en" }, attacker));
    expect(blocked.status).toBe(303);
    expect(blocked.headers.get("location")).toMatch(/^\/en\/login\?error=throttled&retry=15&next=/);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(setCookie(blocked)).toBe("");

    // Other clients are unaffected.
    const other = await login.POST(
      post("/api/auth/login", { password: "s3cret" }, { origin: BASE, "x-forwarded-for": "198.51.100.1" })
    );
    expect(setCookie(other)).toMatch(/^qs_session=/);
  });

  it("does not let concurrent guesses slip past the per-IP limit", async () => {
    const { login } = loadRoutes();
    const attacker = { origin: BASE, "x-forwarded-for": "203.0.113.77" };
    const results = await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        login.POST(post("/api/auth/login", { password: `guess${i}`, locale: "en" }, attacker))
      )
    );
    const evaluated = results.filter((r) => /error=invalid/.test(r.headers.get("location") ?? ""));
    expect(evaluated).toHaveLength(5);
  });

  it("does not let concurrent guesses slip past the overall cap", async () => {
    const { login } = loadRoutes();
    const results = await Promise.all(
      Array.from({ length: 60 }, (_, i) =>
        login.POST(
          post("/api/auth/login", { password: "x", locale: "en" }, { origin: BASE, "x-forwarded-for": `10.9.${i}.1` })
        )
      )
    );
    const evaluated = results.filter((r) => /error=invalid/.test(r.headers.get("location") ?? ""));
    expect(evaluated).toHaveLength(30);
  });

  it("caps guessing overall when X-Forwarded-For is rotated", async () => {
    const { login } = loadRoutes();
    for (let i = 0; i < 30; i++) {
      const res = await login.POST(
        post("/api/auth/login", { password: "x", locale: "en" }, { origin: BASE, "x-forwarded-for": `10.0.0.${i}` })
      );
      expect(res.headers.get("location")).toMatch(/error=invalid/);
    }
    const res = await login.POST(
      post("/api/auth/login", { password: "s3cret", locale: "en" }, { origin: BASE, "x-forwarded-for": "10.0.1.1" })
    );
    expect(res.headers.get("location")).toMatch(/^\/en\/login\?error=throttled&retry=1&/);
    expect(setCookie(res)).toBe("");
  });

  it("sets a long-lived device cookie, scoped to the auth routes, on sign-in", async () => {
    const { login } = loadRoutes();
    const res = await login.POST(post("/api/auth/login", { password: "s3cret", locale: "en" }));
    const device = cookieValue(res, "qs_device");
    expect(device).toBeDefined();
    expect(await verifyDeviceToken(device)).not.toBeNull();
    const raw = res.headers.getSetCookie().find((c) => c.startsWith("qs_device="))!;
    expect(raw).toMatch(/Path=\/api\/auth/);
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/Max-Age=34560000/);

    // A failed attempt sets no device cookie.
    const failed = await login.POST(post("/api/auth/login", { password: "nope", locale: "en" }));
    expect(cookieValue(failed, "qs_device")).toBeUndefined();
  });

  it("keeps the device id when a known device signs in again", async () => {
    const { login } = loadRoutes();
    const token = await createDeviceToken();
    const res = await login.POST(
      post("/api/auth/login", { password: "s3cret" }, { origin: BASE, cookie: `qs_device=${token}` })
    );
    expect(cookieValue(res, "qs_device")).toBe(token);
  });

  // Rotating X-Forwarded-For fills the shared cap; browsers that signed in
  // before must still get in.
  it("lets a known device sign in while the overall cap is full", async () => {
    const { login } = loadRoutes();
    await fillOverallCap(login);
    const device = await createDeviceToken();
    const res = await login.POST(
      post(
        "/api/auth/login",
        { password: "s3cret", locale: "en" },
        { origin: BASE, "x-forwarded-for": "10.0.1.1", cookie: `qs_device=${device}` }
      )
    );
    expect(res.headers.get("location")).toBe("/en");
    expect(setCookie(res)).toMatch(/qs_session=v1\./);
  });

  it("ignores a forged device cookie", async () => {
    const { login } = loadRoutes();
    await fillOverallCap(login);
    const forged = `d1.${"A".repeat(22)}.${"B".repeat(43)}`;
    const res = await login.POST(
      post("/api/auth/login", { password: "s3cret", locale: "en" }, { origin: BASE, cookie: `qs_device=${forged}` })
    );
    expect(res.headers.get("location")).toMatch(/error=throttled/);
    expect(setCookie(res)).toBe("");
  });

  it("limits a known device on its own, whatever address it claims", async () => {
    const { login } = loadRoutes();
    const device = await createDeviceToken();
    for (let i = 0; i < 5; i++) {
      const res = await login.POST(
        post(
          "/api/auth/login",
          { password: `guess${i}`, locale: "en" },
          { origin: BASE, "x-forwarded-for": `172.16.0.${i}`, cookie: `qs_device=${device}` }
        )
      );
      expect(res.headers.get("location")).toMatch(/error=invalid/);
    }
    const blocked = await login.POST(
      post(
        "/api/auth/login",
        { password: "s3cret", locale: "en" },
        { origin: BASE, "x-forwarded-for": "172.16.1.1", cookie: `qs_device=${device}` }
      )
    );
    expect(blocked.headers.get("location")).toMatch(/error=throttled/);

    // Another known device, from the very same address, is unaffected.
    const other = await createDeviceToken();
    const ok = await login.POST(
      post(
        "/api/auth/login",
        { password: "s3cret", locale: "en" },
        { origin: BASE, "x-forwarded-for": "172.16.0.0", cookie: `qs_device=${other}` }
      )
    );
    expect(setCookie(ok)).toMatch(/qs_session=v1\./);
  });

  // Spoofing a victim's address must not lock out their known device.
  it("does not let per-IP failures lock out a known device at that IP", async () => {
    const { login } = loadRoutes();
    const victim = { origin: BASE, "x-forwarded-for": "192.0.2.50" };
    for (let i = 0; i < 5; i++) await login.POST(post("/api/auth/login", { password: "x" }, victim));
    const device = await createDeviceToken();
    const res = await login.POST(
      post("/api/auth/login", { password: "s3cret" }, { ...victim, cookie: `qs_device=${device}` })
    );
    expect(setCookie(res)).toMatch(/qs_session=v1\./);
  });

  it("counts only failures toward the overall cap", async () => {
    const { login } = loadRoutes();
    for (let i = 0; i < 40; i++) {
      const res = await login.POST(
        post("/api/auth/login", { password: "s3cret" }, { origin: BASE, "x-forwarded-for": `10.7.0.${i}` })
      );
      expect(setCookie(res)).toMatch(/qs_session=/);
    }
    const res = await login.POST(
      post("/api/auth/login", { password: "x", locale: "en" }, { origin: BASE, "x-forwarded-for": "10.7.1.1" })
    );
    expect(res.headers.get("location")).toMatch(/error=invalid/);
  });

  it("forgets earlier failures after a successful sign-in", async () => {
    const { login } = loadRoutes();
    const ip = { origin: BASE, "x-forwarded-for": "192.0.2.4" };
    for (let i = 0; i < 4; i++) await login.POST(post("/api/auth/login", { password: "x" }, ip));
    await login.POST(post("/api/auth/login", { password: "s3cret" }, ip));
    for (let i = 0; i < 4; i++) {
      const res = await login.POST(post("/api/auth/login", { password: "x" }, ip));
      expect(res.headers.get("location")).toMatch(/error=invalid/);
    }
  });

  it("just redirects when auth is disabled", async () => {
    process.env.APP_PASSWORD = "";
    const { login } = loadRoutes();
    const res = await login.POST(post("/api/auth/login", { password: "", next: "/en/quotes" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/en/quotes");
    expect(setCookie(res)).toBe("");
  });

  it("tolerates a non-form body", async () => {
    const { login } = loadRoutes();
    const req = new NextRequest(`${BASE}/api/auth/login`, {
      method: "POST",
      body: "{}",
      headers: { host: "localhost:3000", origin: BASE, "content-type": "application/json" },
    });
    const res = await login.POST(req);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toMatch(/error=invalid/);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the cookie and goes to the login page of the form's locale", async () => {
    const { logout } = loadRoutes();
    const res = await logout.POST(post("/api/auth/logout", { locale: "zh-TW" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/zh-TW/login");
    expect(setCookie(res)).toMatch(/^qs_session=;/);
    expect(setCookie(res)).toMatch(/Max-Age=0/);
  });

  it("falls back to the Referer's locale, then the default", async () => {
    const { logout } = loadRoutes();
    const viaReferer = await logout.POST(
      post("/api/auth/logout", {}, { referer: `${BASE}/zh-TW/quotes/3` })
    );
    expect(viaReferer.headers.get("location")).toBe("/zh-TW/login");
    const plain = await logout.POST(post("/api/auth/logout", {}, {}));
    expect(plain.headers.get("location")).toBe("/en/login");
  });

  it("rejects cross-origin logout", async () => {
    const { logout } = loadRoutes();
    const res = await logout.POST(post("/api/auth/logout", {}, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
  });

  it("goes home when auth is disabled", async () => {
    process.env.APP_PASSWORD = "";
    const { logout } = loadRoutes();
    const res = await logout.POST(post("/api/auth/logout", { locale: "en" }));
    expect(res.headers.get("location")).toBe("/en");
  });
});
