import { createRateLimiter, getClientIp } from "@/lib/server/rate-limit";

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

describe("getClientIp", () => {
  const h = (init: Record<string, string>) => new Headers(init);

  it("uses the first X-Forwarded-For entry", () => {
    expect(getClientIp(h({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("falls back to X-Real-IP, then 'unknown'", () => {
    expect(getClientIp(h({ "x-real-ip": " 198.51.100.2 " }))).toBe("198.51.100.2");
    expect(getClientIp(h({ "x-forwarded-for": " , " }))).toBe("unknown");
    expect(getClientIp(h({}))).toBe("unknown");
  });
});
