import { NextRequest, NextResponse } from "next/server";

// Stand-in for next-intl: prefixed paths pass, unprefixed ones are redirected
// to the NEXT_LOCALE cookie's locale (or "en"), like the real middleware.
const intl = jest.fn((req: NextRequest) => {
  const { pathname } = req.nextUrl;
  if (/^\/(en|zh-TW)(\/|$)/.test(pathname)) {
    const res = NextResponse.next();
    res.headers.set("x-test-intl", "1");
    return res;
  }
  const locale = req.cookies.get("NEXT_LOCALE")?.value === "zh-TW" ? "zh-TW" : "en";
  return NextResponse.redirect(new URL(`/${locale}${pathname === "/" ? "" : pathname}`, req.url));
});
jest.mock("next-intl/middleware", () => ({ __esModule: true, default: () => intl }));
jest.mock("@/navigation", () => ({ routing: { locales: ["en", "zh-TW"], defaultLocale: "en" } }));

import proxy, { config } from "@/proxy";
import { createSessionToken } from "@/lib/auth/session";

const ORIGINAL = { ...process.env };
const BASE = "http://localhost:3000";

function req(path: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(`${BASE}${path}`, { method: init.method ?? "GET", headers: init.headers });
}

function location(res: Response): string | null {
  const loc = res.headers.get("location");
  return loc ? loc.replace(BASE, "") : null;
}

beforeEach(() => {
  intl.mockClear();
  process.env.AUTH_SECRET = "0123456789abcdef0123456789abcdef";
  delete process.env.APP_PASSWORD;
});
afterAll(() => {
  process.env = ORIGINAL;
});

describe("proxy: auth disabled", () => {
  it("hands pages to next-intl", async () => {
    const res = await proxy(req("/en/quotes"));
    expect(res.headers.get("x-test-intl")).toBe("1");
    const unprefixed = await proxy(req("/quotes/new"));
    expect(unprefixed.status).toBe(307);
    expect(location(unprefixed)).toBe("/en/quotes/new");
  });

  it("does not touch /api", async () => {
    const res = await proxy(req("/api/quotes/1/pdf"));
    expect(intl).not.toHaveBeenCalled();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("proxy: auth enabled", () => {
  beforeEach(() => {
    process.env.APP_PASSWORD = "s3cret";
  });

  it("401s private API routes and Server Actions with JSON", async () => {
    for (const r of [
      req("/api/quotes/1/pdf"),
      req("/api/export/quotes"),
      req("/en/quotes", { method: "POST", headers: { "next-action": "abc123" } }),
      req("/en/login", { method: "POST", headers: { "next-action": "abc123" } }),
      // No-JS form post: Next finds the action id in the multipart body.
      req("/en/login", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=x" } }),
    ]) {
      const res = await proxy(r);
      expect(res.status).toBe(401);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(await res.json()).toEqual({ error: "UNAUTHENTICATED" });
    }
  });

  it("lets public routes through", async () => {
    expect((await proxy(req("/api/health"))).headers.get("x-middleware-next")).toBe("1");
    expect((await proxy(req("/api/branding-icon"))).headers.get("x-middleware-next")).toBe("1");
    expect((await proxy(req("/en/login"))).headers.get("x-test-intl")).toBe("1");
  });

  it("307s pages to the login page of the path's locale", async () => {
    const res = await proxy(req("/zh-TW/quotes?status=sent"));
    expect(res.status).toBe(307);
    expect(location(res)).toBe("/zh-TW/login?next=%2Fzh-TW%2Fquotes%3Fstatus%3Dsent");
  });

  it("negotiates the locale through next-intl for unprefixed pages", async () => {
    const res = await proxy(req("/quotes/new", { headers: { cookie: "NEXT_LOCALE=zh-TW" } }));
    expect(res.status).toBe(307);
    expect(location(res)).toBe("/zh-TW/login?next=%2Fquotes%2Fnew");
    const fallback = await proxy(req("/"));
    expect(location(fallback)).toBe("/en/login?next=%2F");
  });

  it("treats a tampered cookie as signed out", async () => {
    const token = await createSessionToken();
    const i = token.length - 20;
    const tampered = token.slice(0, i) + (token[i] === "A" ? "B" : "A") + token.slice(i + 1);
    const res = await proxy(req("/en/quotes", { headers: { cookie: `qs_session=${tampered}` } }));
    expect(res.status).toBe(307);
  });

  it("serves everything with a valid session, and sends /login home", async () => {
    const cookie = `qs_session=${await createSessionToken()}`;
    expect((await proxy(req("/en/quotes", { headers: { cookie } }))).headers.get("x-test-intl")).toBe("1");
    expect((await proxy(req("/api/quotes/1/pdf", { headers: { cookie } }))).headers.get("x-middleware-next")).toBe(
      "1"
    );
    const login = await proxy(req("/zh-TW/login", { headers: { cookie } }));
    expect(login.status).toBe(307);
    expect(location(login)).toBe("/zh-TW");
  });
});

describe("proxy: file-like paths", () => {
  it.each([undefined, "s3cret"])("404s stray top-level files without rendering (APP_PASSWORD=%s)", async (pw) => {
    if (pw) process.env.APP_PASSWORD = pw;
    for (const path of ["/favicon.ico", "/foo.json", "/apple-touch-icon.png"]) {
      const res = await proxy(req(path));
      expect(res.status).toBe(404);
      expect(res.headers.get("x-middleware-next")).toBeNull();
    }
    expect(intl).not.toHaveBeenCalled();
  });

  it("passes PWA assets through without auth or locale", async () => {
    process.env.APP_PASSWORD = "s3cret";
    for (const path of ["/sw.js", "/manifest.webmanifest", "/offline.html", "/icons/maskable-512.png"]) {
      expect((await proxy(req(path))).headers.get("x-middleware-next")).toBe("1");
    }
    expect(intl).not.toHaveBeenCalled();
  });

  it("guards dotted page paths like any other page", async () => {
    process.env.APP_PASSWORD = "s3cret";
    const res = await proxy(req("/en/quotes/1.0"));
    expect(res.status).toBe(307);
    expect(location(res)).toBe("/en/login?next=%2Fen%2Fquotes%2F1.0");
  });
});

describe("proxy matcher", () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it.each([
    "/",
    "/en",
    "/en/quotes/1",
    "/en/quotes/1.0",
    "/quotes/new",
    "/api/quotes/1/pdf",
    "/api/health",
    "/foo",
    "/favicon.ico",
    "/sw.js",
    "/icons/any-192.png",
  ])("runs on %s", (p) => expect(matcher.test(p)).toBe(true));

  it.each(["/_next/static/chunks/app.js", "/_next/image"])("skips %s", (p) => expect(matcher.test(p)).toBe(false));
});
