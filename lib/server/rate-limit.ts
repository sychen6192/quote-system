// Adapted from Invoify (https://github.com/al1abb/invoify), MIT License, Copyright (c) 2023 Ali Abbasov.

/**
 * In-memory fixed-window rate limiter.
 *
 * A single-process guard against trivial abuse (password guessing, mail
 * spam, hammering a third-party API), not a distributed quota: every server
 * process keeps its own counters, and they reset on restart. That matches the
 * expected deployment (one container per install).
 */

export type RateLimitResult = {
  /** false once `max` hits have been recorded in the current window. */
  ok: boolean;
  /** 0 when ok; otherwise ms until the window resets (always >= 1). */
  retryAfterMs: number;
  /** Hits left in the current window after this call. */
  remaining: number;
};

export type RateLimiter = {
  /** Records one hit for `key` and reports whether it was within the limit. */
  check(key: string): RateLimitResult;
  /** Same answer as check() would give, without recording a hit. */
  peek(key: string): RateLimitResult;
  /** Refunds one hit recorded by check() (e.g. once it proved legitimate). */
  release(key: string): void;
  /** Forgets `key` (e.g. after a successful login). */
  reset(key: string): void;
};

export type RateLimiterOptions = {
  windowMs: number;
  max: number;
  /** Bounds memory when many distinct keys are seen. Default 10 000. */
  maxKeys?: number;
  /** Clock override for tests. */
  now?: () => number;
};

type Bucket = { count: number; resetAt: number };

export function createRateLimiter({
  windowMs,
  max,
  maxKeys = 10_000,
  now = Date.now,
}: RateLimiterOptions): RateLimiter {
  if (!(windowMs > 0) || !(max >= 1) || !(maxKeys >= 1)) {
    throw new Error("createRateLimiter: windowMs, max and maxKeys must be positive");
  }
  const buckets = new Map<string, Bucket>();

  function live(key: string, t: number): Bucket | undefined {
    const b = buckets.get(key);
    if (b && b.resetAt <= t) {
      buckets.delete(key);
      return undefined;
    }
    return b;
  }

  function makeRoom(t: number) {
    if (buckets.size < maxKeys) return;
    for (const [k, b] of buckets) {
      if (b.resetAt <= t) buckets.delete(k);
    }
    // Still full of live entries: drop the oldest (Map keeps insertion order).
    while (buckets.size >= maxKeys) {
      const oldest = buckets.keys().next().value;
      if (oldest === undefined) break;
      buckets.delete(oldest);
    }
  }

  function result(b: Bucket | undefined, t: number): RateLimitResult {
    const count = b?.count ?? 0;
    if (b && count >= max) {
      return { ok: false, retryAfterMs: Math.max(1, b.resetAt - t), remaining: 0 };
    }
    return { ok: true, retryAfterMs: 0, remaining: max - count };
  }

  return {
    check(key) {
      const t = now();
      let b = live(key, t);
      if (b && b.count >= max) return result(b, t);
      if (!b) {
        makeRoom(t);
        b = { count: 0, resetAt: t + windowMs };
        buckets.set(key, b);
      }
      b.count += 1;
      return { ok: true, retryAfterMs: 0, remaining: max - b.count };
    },
    peek(key) {
      const t = now();
      return result(live(key, t), t);
    },
    release(key) {
      const b = live(key, now());
      if (b && b.count > 0) b.count -= 1;
    },
    reset(key) {
      buckets.delete(key);
    },
  };
}

/**
 * Records one hit on every `[limiter, key]` pair, but only when all of them
 * allow it; otherwise records nothing and returns the first refusal. Keeps a
 * request refused by one limit from using up another's budget.
 */
export function checkAll(entries: ReadonlyArray<readonly [RateLimiter, string]>): RateLimitResult {
  for (const [limiter, key] of entries) {
    const r = limiter.peek(key);
    if (!r.ok) return r;
  }
  let remaining = Number.POSITIVE_INFINITY;
  for (const [limiter, key] of entries) {
    remaining = Math.min(remaining, limiter.check(key).remaining);
  }
  return { ok: true, retryAfterMs: 0, remaining: Number.isFinite(remaining) ? remaining : 0 };
}

type HeaderSource = { get(name: string): string | null };
type Env = Record<string, string | undefined>;

function trustedHops(env: Env): number {
  const raw = (env.TRUST_PROXY_HOPS ?? "").trim();
  if (!/^\d+$/.test(raw)) return 1;
  const n = Number(raw);
  return n >= 1 ? n : 1;
}

/**
 * Best-effort client address for rate-limit keys: the X-Forwarded-For entry
 * written by the nearest proxy, i.e. the right-most one (or the
 * TRUST_PROXY_HOPS-th from the right when several trusted proxies append).
 * The bundled Caddy replaces the header, Cloudflare appends the address it
 * saw, and Next fills it with the socket address only when it is absent; the
 * left-most entry is whatever the client chose to send.
 *
 * A client talking to the app directly still controls the whole header, so
 * use this to slow abuse down, never to authorise anything, and never as the
 * only limit.
 */
export function getClientIp(headers: HeaderSource, env: Env = process.env): string {
  const entries = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (entries.length > 0) {
    return entries[Math.max(0, entries.length - trustedHops(env))];
  }
  const real = headers.get("x-real-ip")?.trim();
  return real || "unknown";
}
