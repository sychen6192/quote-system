import { checkAll, createRateLimiter, getClientIp } from "@/lib/server/rate-limit";

function clock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe("createRateLimiter", () => {
  it("allows `max` hits per window, then blocks with retryAfterMs", () => {
    const c = clock();
    const rl = createRateLimiter({ windowMs: 60_000, max: 3, now: c.now });

    expect(rl.check("a")).toEqual({ ok: true, retryAfterMs: 0, remaining: 2 });
    expect(rl.check("a")).toEqual({ ok: true, retryAfterMs: 0, remaining: 1 });
    expect(rl.check("a")).toEqual({ ok: true, retryAfterMs: 0, remaining: 0 });

    c.advance(10_000);
    expect(rl.check("a")).toEqual({ ok: false, retryAfterMs: 50_000, remaining: 0 });
  });

  it("keeps keys independent", () => {
    const c = clock();
    const rl = createRateLimiter({ windowMs: 1000, max: 1, now: c.now });
    expect(rl.check("a").ok).toBe(true);
    expect(rl.check("a").ok).toBe(false);
    expect(rl.check("b").ok).toBe(true);
  });

  it("starts a fresh window once the old one has expired", () => {
    const c = clock();
    const rl = createRateLimiter({ windowMs: 1000, max: 1, now: c.now });
    rl.check("a");
    expect(rl.check("a").ok).toBe(false);
    c.advance(1000);
    expect(rl.check("a")).toEqual({ ok: true, retryAfterMs: 0, remaining: 0 });
  });

  it("does not extend the window while blocked", () => {
    const c = clock();
    const rl = createRateLimiter({ windowMs: 1000, max: 1, now: c.now });
    rl.check("a");
    c.advance(400);
    expect(rl.check("a").retryAfterMs).toBe(600);
    c.advance(400);
    expect(rl.check("a").retryAfterMs).toBe(200);
    c.advance(200);
    expect(rl.check("a").ok).toBe(true);
  });

  it("peek() reports without recording a hit", () => {
    const c = clock();
    const rl = createRateLimiter({ windowMs: 1000, max: 2, now: c.now });
    expect(rl.peek("a")).toEqual({ ok: true, retryAfterMs: 0, remaining: 2 });
    rl.check("a");
    expect(rl.peek("a")).toEqual({ ok: true, retryAfterMs: 0, remaining: 1 });
    expect(rl.peek("a")).toEqual({ ok: true, retryAfterMs: 0, remaining: 1 });
    rl.check("a");
    expect(rl.peek("a")).toEqual({ ok: false, retryAfterMs: 1000, remaining: 0 });
    c.advance(1000);
    expect(rl.peek("a").ok).toBe(true);
  });

  it("release() refunds one recorded hit", () => {
    const c = clock();
    const rl = createRateLimiter({ windowMs: 1000, max: 2, now: c.now });
    rl.check("a");
    rl.check("a");
    expect(rl.peek("a").ok).toBe(false);
    rl.release("a");
    expect(rl.peek("a")).toEqual({ ok: true, retryAfterMs: 0, remaining: 1 });
    rl.release("a");
    rl.release("a");
    rl.release("unknown");
    expect(rl.peek("a")).toEqual({ ok: true, retryAfterMs: 0, remaining: 2 });
  });

  it("reset() forgets a key", () => {
    const rl = createRateLimiter({ windowMs: 1000, max: 1 });
    rl.check("a");
    expect(rl.check("a").ok).toBe(false);
    rl.reset("a");
    expect(rl.check("a").ok).toBe(true);
  });

  it("stays bounded: evicts expired keys first, then the oldest live key", () => {
    const c = clock();
    const rl = createRateLimiter({ windowMs: 1000, max: 1, maxKeys: 2, now: c.now });
    rl.check("old");
    c.advance(500);
    rl.check("mid");
    c.advance(600); // "old" expired, "mid" still live
    rl.check("new"); // room made by dropping expired "old"
    expect(rl.peek("mid").ok).toBe(false);
    expect(rl.peek("new").ok).toBe(false);

    rl.check("newest"); // both live: the oldest ("mid") is evicted
    expect(rl.peek("mid").ok).toBe(true);
    expect(rl.peek("new").ok).toBe(false);
    expect(rl.peek("newest").ok).toBe(false);
  });

  it("rejects nonsensical options", () => {
    expect(() => createRateLimiter({ windowMs: 0, max: 1 })).toThrow();
    expect(() => createRateLimiter({ windowMs: 1000, max: 0 })).toThrow();
    expect(() => createRateLimiter({ windowMs: 1000, max: 1, maxKeys: 0 })).toThrow();
  });
});

describe("checkAll", () => {
  it("records a hit on every limiter only when all allow it", () => {
    const c = clock();
    const perKey = createRateLimiter({ windowMs: 1000, max: 2, now: c.now });
    const all = createRateLimiter({ windowMs: 1000, max: 3, maxKeys: 1, now: c.now });
    const hit = (ip: string) => checkAll([[perKey, ip], [all, "*"]]);

    expect(hit("a")).toEqual({ ok: true, retryAfterMs: 0, remaining: 1 });
    expect(hit("a")).toEqual({ ok: true, retryAfterMs: 0, remaining: 0 });
    // Refused per key: must not use up the shared budget.
    expect(hit("a")).toMatchObject({ ok: false, retryAfterMs: 1000 });
    expect(all.peek("*").remaining).toBe(1);
    expect(hit("b").ok).toBe(true);
    // Shared cap reached: refused for everyone, and "c" is not charged.
    expect(hit("c")).toMatchObject({ ok: false });
    expect(perKey.peek("c").remaining).toBe(2);
  });
});

describe("getClientIp", () => {
  const h = (init: Record<string, string>) => new Headers(init);

  // The right-most entry is the one the nearest proxy wrote (Caddy replaces
  // the header, Cloudflare appends the real client); the left-most is whatever
  // the client sent.
  it("uses the right-most X-Forwarded-For entry", () => {
    expect(getClientIp(h({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("10.0.0.1");
    expect(getClientIp(h({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("2.2.2.2");
    expect(getClientIp(h({ "x-forwarded-for": "198.51.100.3" }))).toBe("198.51.100.3");
    expect(getClientIp(h({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, " }))).toBe("2.2.2.2");
  });

  it("skips TRUST_PROXY_HOPS - 1 trusted proxies from the right", () => {
    const xff = h({ "x-forwarded-for": "6.6.6.6, 203.0.113.7, 10.0.0.2" });
    expect(getClientIp(xff, { TRUST_PROXY_HOPS: "2" })).toBe("203.0.113.7");
    expect(getClientIp(xff, { TRUST_PROXY_HOPS: "1" })).toBe("10.0.0.2");
    // More hops than entries: the left-most entry is the best guess.
    expect(getClientIp(xff, { TRUST_PROXY_HOPS: "9" })).toBe("6.6.6.6");
    for (const bad of ["", "0", "-1", "abc", "1.5"]) {
      expect(getClientIp(xff, { TRUST_PROXY_HOPS: bad })).toBe("10.0.0.2");
    }
  });

  it("falls back to X-Real-IP, then 'unknown'", () => {
    expect(getClientIp(h({ "x-real-ip": " 198.51.100.2 " }))).toBe("198.51.100.2");
    expect(getClientIp(h({ "x-forwarded-for": " , " }))).toBe("unknown");
    expect(getClientIp(h({}))).toBe("unknown");
  });
});
