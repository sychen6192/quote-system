import type { NextRequest } from "next/server";
import { formString, isHttpsRequest, jsonError, readForm, requestLocale, seeOther } from "@/lib/auth/http";
import { isSameOrigin } from "@/lib/auth/origin";
import { safeNextPath } from "@/lib/auth/paths";
import {
  SESSION_COOKIE,
  authEnabled,
  createSessionToken,
  passwordMatches,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { createRateLimiter, getClientIp } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

const MAX_PASSWORD_LENGTH = 1024;

// Every attempt is counted before the password check; a successful sign-in
// then clears its IP's count, so the per-IP limit means consecutive failures.
const attemptsPerIp = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
// The per-IP key comes from X-Forwarded-For, which a client talking to the app
// directly (no reverse proxy) can rotate at will. This shared cap bounds the
// guessing rate even then (successful sign-ins count too, which is harmless at
// this rate); existing sessions are unaffected while it trips.
const attemptsOverall = createRateLimiter({ windowMs: 60 * 1000, max: 30, maxKeys: 1 });
const ALL = "*";

function loginErrorUrl(locale: string, next: string, error: string, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ error, ...extra, next });
  return `/${locale}/login?${params.toString()}`;
}

export async function POST(req: NextRequest) {
  // Route handlers get no built-in CSRF protection (Server Actions do).
  if (!isSameOrigin(req.headers)) return jsonError("CROSS_ORIGIN", 403);

  const form = await readForm(req);
  const rawNext = formString(form, "next");
  const locale = requestLocale(req, formString(form, "locale"), rawNext);
  const next = safeNextPath(rawNext, `/${locale}`);

  if (!authEnabled()) return seeOther(next);

  const ip = getClientIp(req.headers);
  const perIp = attemptsPerIp.peek(ip);
  const overall = attemptsOverall.peek(ALL);
  const gate = !perIp.ok ? perIp : overall;
  if (!gate.ok) {
    const minutes = String(Math.max(1, Math.ceil(gate.retryAfterMs / 60_000)));
    return seeOther(loginErrorUrl(locale, next, "throttled", { retry: minutes }), {
      "Retry-After": String(Math.ceil(gate.retryAfterMs / 1000)),
    });
  }

  // Count now, synchronously after the peek: recording only after the awaited
  // check below would let a burst of concurrent guesses all pass the gate.
  attemptsPerIp.check(ip);
  attemptsOverall.check(ALL);

  const password = formString(form, "password");
  const ok = password.length <= MAX_PASSWORD_LENGTH && (await passwordMatches(password));
  if (!ok) return seeOther(loginErrorUrl(locale, next, "invalid"));

  attemptsPerIp.reset(ip);
  const res = seeOther(next);
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions(isHttpsRequest(req)));
  return res;
}
