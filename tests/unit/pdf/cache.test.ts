import {
  PDF_CACHE_MAX_BYTES,
  PDF_CACHE_MAX_ENTRIES,
  clearPdfCache,
  getCachedPdf,
  pdfCacheKey,
  pdfCacheStats,
  setCachedPdf,
} from "@/lib/pdf/cache";

const pdf = (bytes: number, fill = 1) => new Uint8Array(bytes).fill(fill);
const MB = 1024 * 1024;

beforeEach(() => clearPdfCache());

describe("pdfCacheKey", () => {
  const parts = {
    id: 7,
    updatedAt: new Date("2026-10-09T01:02:03.000Z"),
    lang: "zh-TW",
    version: "abc",
    today: "2026-10-09",
  };

  it("is a sha256 hex digest, equal for Date and ISO string", () => {
    const key = pdfCacheKey(parts);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(pdfCacheKey({ ...parts, updatedAt: "2026-10-09T01:02:03.000Z" })).toBe(key);
  });

  it.each<[string, Partial<typeof parts>]>([
    ["id", { id: 8 }],
    ["updatedAt", { updatedAt: new Date("2026-10-09T01:02:04.000Z") }],
    ["lang", { lang: "en" }],
    ["settings version", { version: "abd" }],
    ["day (expiry badge)", { today: "2026-10-10" }],
  ])("changes with %s", (_label, change) => {
    expect(pdfCacheKey({ ...parts, ...change })).not.toBe(pdfCacheKey(parts));
  });
});

describe("LRU", () => {
  it("returns what was stored", () => {
    const a = pdf(10);
    setCachedPdf("a", a);
    expect(getCachedPdf("a")).toBe(a);
    expect(getCachedPdf("missing")).toBeNull();
  });

  it(`keeps at most ${PDF_CACHE_MAX_ENTRIES} entries, evicting the least recently used`, () => {
    for (let i = 0; i < PDF_CACHE_MAX_ENTRIES; i++) setCachedPdf(`k${i}`, pdf(10));
    getCachedPdf("k0"); // k0 is now the most recent; k1 is the oldest
    setCachedPdf("new", pdf(10));
    expect(pdfCacheStats().entries).toBe(PDF_CACHE_MAX_ENTRIES);
    expect(getCachedPdf("k1")).toBeNull();
    expect(getCachedPdf("k0")).not.toBeNull();
    expect(getCachedPdf("new")).not.toBeNull();
  });

  it("evicts by total size (16 MB)", () => {
    setCachedPdf("a", pdf(6 * MB));
    setCachedPdf("b", pdf(6 * MB));
    setCachedPdf("c", pdf(6 * MB));
    expect(getCachedPdf("a")).toBeNull();
    expect(getCachedPdf("b")).not.toBeNull();
    expect(getCachedPdf("c")).not.toBeNull();
    expect(pdfCacheStats().bytes).toBe(12 * MB);
  });

  it("never stores a single PDF larger than the whole cache", () => {
    setCachedPdf("small", pdf(10));
    setCachedPdf("huge", pdf(PDF_CACHE_MAX_BYTES + 1));
    expect(getCachedPdf("huge")).toBeNull();
    expect(getCachedPdf("small")).not.toBeNull();
  });

  it("replaces an entry with the same key without double-counting bytes", () => {
    setCachedPdf("a", pdf(100, 1));
    setCachedPdf("a", pdf(50, 2));
    expect(pdfCacheStats()).toEqual({ entries: 1, bytes: 50 });
    expect(getCachedPdf("a")?.[0]).toBe(2);
  });
});
