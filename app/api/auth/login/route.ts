import type { NextRequest } from "next/server";
import { formString, isHttpsRequest, jsonError, readForm, requestLocale, seeOther } from "@/lib/auth/http";
import { isSameOrigin } from "@/lib/auth/origin";
import { safeNextPath } from "@/lib/auth/paths";
import {
  DEVICE_COOKIE,
  SESSION_COOKIE,
  authEnabled,
  createDeviceToken,
  createSessionToken,
  deviceCookieOptions,
  passwordMatches,
  sessionCookieOptions,
  verifyDeviceToken,
} from "@/lib/auth/session";
import { createRateLimiter, getClientIp } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

const MAX_PASSWORD_LENGTH = 1024;

// Every attempt is counted before the password check (synchronously after the
// gate, so a burst of concurrent guesses cannot all pass it); a successful
// sign-in then clears or refunds what it was counted for, so every limit
// below means failures.
//
// A browser that has signed in before carries a signed device cookie and is
// limited on its own (5 consecutive failures per 15 min), never by address or
// the shared cap: those can be filled by anyone, the device cookie cannot be
// minted without the password (OWASP's device-cookie lockout defence).
const attemptsPerDevice = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
// Unknown browsers: 5 consecutive failures per address per 15 min...
const attemptsPerIp = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
// ...but the address comes from X-Forwarded-For, which a client talking to
// the app directly can rotate at will, so a shared cap of 30 failures a
// minute bounds the guessing rate even then. While it trips, only browsers
// that never signed in here (or since the password changed) wait; known
// devices and existing sessions are unaffected.
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

  const deviceId = await verifyDeviceToken(req.cookies.get(DEVICE_COOKIE)?.value);
  const ip = getClientIp(req.headers);
  const deviceKey = `device:${deviceId}`;

  // No await between the peek and the check below.
  const gate = deviceId
    ? attemptsPerDevice.peek(deviceKey)
    : [attemptsPerIp.peek(ip), attemptsOverall.peek(ALL)].find((r) => !r.ok);
  if (gate && !gate.ok) {
    const minutes = String(Math.max(1, Math.ceil(gate.retryAfterMs / 60_000)));
    return seeOther(loginErrorUrl(locale, next, "throttled", { retry: minutes }), {
      "Retry-After": String(Math.ceil(gate.retryAfterMs / 1000)),
    });
  }
  if (deviceId) {
    attemptsPerDevice.check(deviceKey);
  } else {
    attemptsPerIp.check(ip);
    attemptsOverall.check(ALL);
  }

  const password = formString(form, "password");
  const ok = password.length <= MAX_PASSWORD_LENGTH && (await passwordMatches(password));
  if (!ok) return seeOther(loginErrorUrl(locale, next, "invalid"));

  if (deviceId) {
    attemptsPerDevice.reset(deviceKey);
  } else {
    attemptsPerIp.reset(ip);
    attemptsOverall.release(ALL);
  }
  const https = isHttpsRequest(req);
  const res = seeOther(next);
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions(https));
  // Re-issued (same id) so a device in regular use never expires.
  res.cookies.set(DEVICE_COOKIE, await createDeviceToken(deviceId ?? undefined), deviceCookieOptions(https));
  return res;
}
