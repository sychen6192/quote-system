import {
  DEVICE_TTL_SECONDS,
  MIN_AUTH_SECRET_LENGTH,
  SESSION_TTL_SECONDS,
  authEnabled,
  cleanEnv,
  createDeviceToken,
  createSessionToken,
  deviceCookieOptions,
  passwordMatches,
  resolveAuthSecret,
  sessionCookieOptions,
  verifyDeviceToken,
  verifySessionToken,
} from "@/lib/auth/session";

const WARNED = Symbol.for("quote-system.auth.secret-warned");
const SECRET = "0123456789abcdef0123456789abcdef";
const env = (overrides: Record<string, string | undefined> = {}) => ({
  APP_PASSWORD: "s3cret",
  AUTH_SECRET: SECRET,
  ...overrides,
});

let warn: jest.SpyInstance;
beforeEach(() => {
  delete (globalThis as { [WARNED]?: boolean })[WARNED];
  warn = jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe("cleanEnv / authEnabled", () => {
  it("strips whitespace and one layer of matching quotes", () => {
    expect(cleanEnv(undefined)).toBe("");
    expect(cleanEnv("  pw  ")).toBe("pw");
    expect(cleanEnv('"pw"')).toBe("pw");
    expect(cleanEnv("'pw'")).toBe("pw");
    expect(cleanEnv(`"pw'`)).toBe(`"pw'`);
  });

  it("is enabled only for a non-empty APP_PASSWORD", () => {
    expect(authEnabled({})).toBe(false);
    expect(authEnabled({ APP_PASSWORD: "" })).toBe(false);
    expect(authEnabled({ APP_PASSWORD: "   " })).toBe(false);
    expect(authEnabled({ APP_PASSWORD: '""' })).toBe(false);
    expect(authEnabled({ APP_PASSWORD: "x" })).toBe(true);
  });
});

describe("resolveAuthSecret", () => {
  it("uses AUTH_SECRET as is, without warning", () => {
    expect(resolveAuthSecret(env())).toBe(SECRET);
    expect(warn).not.toHaveBeenCalled();
  });

  it("derives a secret from APP_PASSWORD and warns once per process", () => {
    const a = resolveAuthSecret(env({ AUTH_SECRET: "" }));
    const b = resolveAuthSecret(env({ AUTH_SECRET: undefined }));
    expect(a).toBe(b);
    expect(a).toContain("s3cret");
    expect(resolveAuthSecret(env({ AUTH_SECRET: "", APP_PASSWORD: "other" }))).not.toBe(a);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/AUTH_SECRET is not set/);
  });

  it("warns about a short secret", () => {
    expect(resolveAuthSecret(env({ AUTH_SECRET: "short" }))).toBe("short");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(String(MIN_AUTH_SECRET_LENGTH));
  });
});

describe("session tokens", () => {
  const now = Date.UTC(2026, 9, 9, 12, 0, 0);

  it("has the v1.<exp>.<b64url sig> shape with a 30-day expiry", async () => {
    const token = await createSessionToken(now, env());
    const m = /^v1\.(\d+)\.([A-Za-z0-9_-]{43})$/.exec(token);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBe(Math.floor(now / 1000) + SESSION_TTL_SECONDS);
  });

  it("verifies its own tokens until they expire", async () => {
    const token = await createSessionToken(now, env());
    expect(await verifySessionToken(token, now, env())).toBe(true);
    expect(await verifySessionToken(token, now + (SESSION_TTL_SECONDS - 1) * 1000, env())).toBe(true);
    expect(await verifySessionToken(token, now + SESSION_TTL_SECONDS * 1000, env())).toBe(false);
  });

  it("rejects missing, malformed and tampered tokens", async () => {
    const token = await createSessionToken(now, env());
    const [v, exp, sig] = token.split(".");
    const flipped = sig.slice(0, 10) + (sig[10] === "A" ? "B" : "A") + sig.slice(11);
    for (const bad of [
      undefined,
      null,
      "",
      "garbage",
      `${v}.${exp}`,
      `v2.${exp}.${sig}`,
      `${v}.${Number(exp) + 1}.${sig}`, // extended expiry, old signature
      `${v}.${exp}.${flipped}`,
      `${token}x`,
    ]) {
      expect(await verifySessionToken(bad, now, env())).toBe(false);
    }
  });

  it("accepts only the canonical base64url spelling of the signature", async () => {
    const token = await createSessionToken(now, env());
    const last = token.at(-1)!;
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const i = alphabet.indexOf(last);
    // Same decoded bytes: only the 2 unused low bits differ.
    const twin = alphabet[(i & ~3) | ((i + 1) & 3)];
    expect(twin).not.toBe(last);
    expect(await verifySessionToken(token.slice(0, -1) + twin, now, env())).toBe(false);
    expect(await verifySessionToken(token, now, env())).toBe(true);
  });

  it("is invalidated by a password or secret change", async () => {
    const token = await createSessionToken(now, env());
    expect(await verifySessionToken(token, now, env({ APP_PASSWORD: "n3w" }))).toBe(false);
    expect(await verifySessionToken(token, now, env({ AUTH_SECRET: SECRET.toUpperCase() }))).toBe(false);
  });

  it("works with a derived secret too", async () => {
    const e = env({ AUTH_SECRET: "" });
    const token = await createSessionToken(now, e);
    expect(await verifySessionToken(token, now, e)).toBe(true);
    expect(await verifySessionToken(token, now, env())).toBe(false);
  });
});

describe("passwordMatches", () => {
  it("accepts only the configured password", async () => {
    expect(await passwordMatches("s3cret", env())).toBe(true);
    expect(await passwordMatches("s3cre", env())).toBe(false);
    expect(await passwordMatches("s3cret ", env())).toBe(false);
    expect(await passwordMatches("", env())).toBe(false);
  });

  it("compares against the cleaned env value", async () => {
    expect(await passwordMatches("s3cret", env({ APP_PASSWORD: '"s3cret"' }))).toBe(true);
  });

  it("never matches when auth is disabled", async () => {
    expect(await passwordMatches("", env({ APP_PASSWORD: "" }))).toBe(false);
  });
});

describe("sessionCookieOptions", () => {
  it("is httpOnly, SameSite=Lax, 30 days, Secure only over HTTPS", () => {
    expect(sessionCookieOptions(false)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    expect(sessionCookieOptions(true).secure).toBe(true);
  });
});

describe("device tokens", () => {
  it("round-trips a fresh random id, signed with the session key", async () => {
    const a = await createDeviceToken(undefined, env());
    const b = await createDeviceToken(undefined, env());
    expect(a).toMatch(/^d1\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
    const id = await verifyDeviceToken(a, env());
    expect(id).toBe(a.split(".")[1]);
    expect(await createDeviceToken(id!, env())).toBe(a);
  });

  it("rejects missing, malformed, tampered and re-keyed tokens", async () => {
    const token = await createDeviceToken(undefined, env());
    const [d, id, sig] = token.split(".");
    for (const bad of [
      undefined,
      null,
      "",
      "garbage",
      `${d}.${id}`,
      `d2.${id}.${sig}`,
      `${d}.${id.replace(/^./, (c) => (c === "A" ? "B" : "A"))}.${sig}`,
      `${d}.${id}.${sig.replace(/^./, (c) => (c === "A" ? "B" : "A"))}`,
    ]) {
      expect(await verifyDeviceToken(bad, env())).toBeNull();
    }
    expect(await verifyDeviceToken(token, env({ APP_PASSWORD: "other" }))).toBeNull();
    expect(await verifyDeviceToken(token, env({ AUTH_SECRET: "f".repeat(32) }))).toBeNull();
  });

  it("is never accepted as a session, nor a session as a device", async () => {
    const device = await createDeviceToken(undefined, env());
    const session = await createSessionToken(Date.now(), env());
    expect(await verifySessionToken(device, Date.now(), env())).toBe(false);
    expect(await verifyDeviceToken(session, env())).toBeNull();
  });

  it("is a long-lived httpOnly cookie scoped to the auth routes", () => {
    expect(deviceCookieOptions(false)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/api/auth",
      maxAge: DEVICE_TTL_SECONDS,
    });
    expect(deviceCookieOptions(true).secure).toBe(true);
    expect(DEVICE_TTL_SECONDS).toBeLessThanOrEqual(400 * 24 * 60 * 60);
  });
});
