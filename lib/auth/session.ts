// Web Crypto only (no node:crypto): imported by proxy.ts, route handlers and
// server actions alike, whatever runtime they end up compiled for.

type Env = Record<string, string | undefined>;

export const SESSION_COOKIE = "qs_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const MIN_AUTH_SECRET_LENGTH = 32;

const enc = new TextEncoder();

// docker --env-file keeps quotes literally; strip one layer like lib/config.ts.
export function cleanEnv(raw: string | undefined): string {
  const v = (raw ?? "").trim();
  if (
    v.length >= 2 &&
    ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

/** Password protection is on iff APP_PASSWORD is non-empty. */
export function authEnabled(env: Env = process.env): boolean {
  return cleanEnv(env.APP_PASSWORD) !== "";
}

// One warning per process, even though proxy, route handlers and actions are
// separate bundles with their own copy of this module.
const WARNED = Symbol.for("quote-system.auth.secret-warned");
function warnOnce(message: string) {
  const g = globalThis as { [WARNED]?: boolean };
  if (g[WARNED]) return;
  g[WARNED] = true;
  console.warn(message);
}

/**
 * The secret that, together with APP_PASSWORD, keys the session HMAC.
 * Without AUTH_SECRET the key depends on the password alone, so a captured
 * cookie would allow an offline guess of the password: still works, but warn.
 */
export function resolveAuthSecret(env: Env = process.env): string {
  const secret = cleanEnv(env.AUTH_SECRET);
  if (secret === "") {
    warnOnce(
      "[auth] AUTH_SECRET is not set; deriving the session key from APP_PASSWORD. " +
        `Set AUTH_SECRET to a random string of at least ${MIN_AUTH_SECRET_LENGTH} characters ` +
        "(e.g. `openssl rand -hex 32`)."
    );
    return `derived-from-app-password:${cleanEnv(env.APP_PASSWORD)}`;
  }
  if (secret.length < MIN_AUTH_SECRET_LENGTH) {
    warnOnce(
      `[auth] AUTH_SECRET is shorter than ${MIN_AUTH_SECRET_LENGTH} characters; use a longer random value.`
    );
  }
  return secret;
}

let cachedKey: { fingerprint: string; key: Promise<CryptoKey> } | null = null;

function hmacKey(env: Env): Promise<CryptoKey> {
  // SHA-256(AUTH_SECRET \0 APP_PASSWORD): the secret gives the key entropy,
  // and mixing in the password means changing it signs everyone out.
  const fingerprint = `${resolveAuthSecret(env)}\0${cleanEnv(env.APP_PASSWORD)}`;
  if (cachedKey?.fingerprint !== fingerprint) {
    cachedKey = {
      fingerprint,
      key: crypto.subtle
        .digest("SHA-256", enc.encode(fingerprint))
        .then((raw) =>
          crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, [
            "sign",
            "verify",
          ])
        ),
    };
  }
  return cachedKey.key;
}

function toBase64Url(buf: ArrayBuffer): string {
  let bin = "";
  for (const byte of new Uint8Array(buf)) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** `v1.<expUnixSeconds>.<base64url(HMAC-SHA256(key, "v1.<exp>"))>` */
export async function createSessionToken(
  nowMs: number = Date.now(),
  env: Env = process.env
): Promise<string> {
  const payload = `v1.${Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS}`;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode(payload));
  return `${payload}.${toBase64Url(sig)}`;
}

const TOKEN_RE = /^(v1\.(\d{1,12}))\.([A-Za-z0-9_-]{43})$/;

export async function verifySessionToken(
  token: string | undefined | null,
  nowMs: number = Date.now(),
  env: Env = process.env
): Promise<boolean> {
  if (!token) return false;
  const m = TOKEN_RE.exec(token);
  if (!m || Number(m[2]) * 1000 <= nowMs) return false;
  const sig = fromBase64Url(m[3]);
  // The last of 43 base64 chars carries 2 unused bits: accept only the
  // canonical spelling so one token never has several valid forms.
  if (toBase64Url(sig.buffer) !== m[3]) return false;
  // subtle.verify compares in constant time.
  return crypto.subtle.verify("HMAC", await hmacKey(env), sig, enc.encode(m[1]));
}

/** Constant-time password check: compares HMACs, never the raw strings. */
export async function passwordMatches(input: string, env: Env = process.env): Promise<boolean> {
  const expected = cleanEnv(env.APP_PASSWORD);
  if (expected === "") return false;
  const key = await hmacKey(env);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(input));
  return crypto.subtle.verify("HMAC", key, mac, enc.encode(expected));
}

export type SessionCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

/**
 * `secure` only when the browser is really on HTTPS: a plain-HTTP LAN install
 * (http://192.168.x.x) would otherwise silently drop the cookie and loop on login.
 */
export function sessionCookieOptions(isHttps: boolean): SessionCookieOptions {
  return { httpOnly: true, sameSite: "lax", secure: isHttps, path: "/", maxAge: SESSION_TTL_SECONDS };
}
