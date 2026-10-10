jest.mock("@/lib/auth/guard", () => ({
  assertAuthenticated: jest.fn(),
  isUnauthenticatedError: (e: unknown) => e instanceof Error && e.message === "UNAUTHENTICATED",
}));
jest.mock("@/lib/pdf/quote-pdf", () => ({
  loadQuoteForPdf: jest.fn(),
  renderQuotePdf: jest.fn(),
}));
jest.mock("@/services/settings", () => ({
  getSettings: jest.fn(),
  getDocumentBranding: jest.fn(),
}));

import { NextRequest } from "next/server";
import { GET, dynamic, runtime } from "@/app/api/quotes/[id]/pdf/route";
import { assertAuthenticated } from "@/lib/auth/guard";
import { clearPdfCache } from "@/lib/pdf/cache";
import { loadQuoteForPdf, renderQuotePdf } from "@/lib/pdf/quote-pdf";
import { getDocumentBranding, getSettings } from "@/services/settings";

const mockAuth = assertAuthenticated as jest.Mock;
const mockLoad = loadQuoteForPdf as jest.Mock;
const mockRender = renderQuotePdf as jest.Mock;
const mockSettings = getSettings as jest.Mock;
const mockBranding = getDocumentBranding as jest.Mock;

const PDF = new Uint8Array(Buffer.from("%PDF-1.3\n%fake\n%%EOF"));
const BRANDING = { logoSrc: "data:image/png;base64,AAAA", stampSrc: null };

function quote(overrides: Record<string, unknown> = {}) {
  return {
    id: 12,
    quotationNumber: "QT-20261009-001",
    updatedAt: new Date("2026-10-09T03:00:00Z"),
    customer: null,
    items: [],
    ...overrides,
  };
}

function get(id: string, query = "", headers: Record<string, string> = {}) {
  const url = `http://localhost:3000/api/quotes/${encodeURIComponent(id)}/pdf${query}`;
  // Next hands route handlers decoded params.
  return GET(new NextRequest(url, { headers }), { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  clearPdfCache();
  mockAuth.mockResolvedValue(undefined);
  mockLoad.mockResolvedValue(quote());
  mockRender.mockResolvedValue(PDF);
  mockSettings.mockResolvedValue({
    version: "v1",
    region: { timezone: "Asia/Taipei" },
    quote: { defaultTaxRate: 5 },
  });
  mockBranding.mockResolvedValue(BRANDING);
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe("GET /api/quotes/[id]/pdf", () => {
  it("runs on Node and is never prerendered", () => {
    expect(runtime).toBe("nodejs");
    expect(dynamic).toBe("force-dynamic");
  });

  it("answers 401 before reading anything when unauthenticated", async () => {
    mockAuth.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    const res = await get("12");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "UNAUTHENTICATED" });
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it.each(["abc", "0", "-1", "1.5", "1e3", " 12", "12abc", "2147483648", "99999999999", "０１", ""])(
    "404s for id %p without querying",
    async (id) => {
      const res = await get(id);
      expect(res.status).toBe(404);
      expect(mockLoad).not.toHaveBeenCalled();
    }
  );

  it("accepts the largest int4 id", async () => {
    await get("2147483647");
    expect(mockLoad).toHaveBeenCalledWith(2147483647);
  });

  it("404s for a missing quote", async () => {
    mockLoad.mockResolvedValueOnce(null);
    const res = await get("404");
    expect(res.status).toBe(404);
    expect(mockRender).not.toHaveBeenCalled();
  });

  it("renders inline by default with private, no-store headers", async () => {
    const res = await get("12");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-length")).toBe(String(PDF.byteLength));
    expect(res.headers.get("content-disposition")).toBe('inline; filename="Quotation-QT-20261009-001.pdf"');
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-pdf-cache")).toBe("miss");
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
    expect(mockLoad).toHaveBeenCalledWith(12);
    expect(mockBranding).toHaveBeenCalledWith("pdf");
    expect(mockRender).toHaveBeenCalledWith(expect.objectContaining({ id: 12 }), BRANDING, {
      lang: "en",
      today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it("sends an attachment with ?download=1", async () => {
    const res = await get("12", "?download=1");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="Quotation-QT-20261009-001.pdf"'
    );
  });

  it("uses an RFC 5987 filename for non-ASCII quote numbers", async () => {
    mockLoad.mockResolvedValueOnce(quote({ quotationNumber: "報價-001" }));
    const res = await get("12", "?download=1");
    expect(res.headers.get("content-disposition")).toBe(
      "attachment; filename=\"Quotation-__-001.pdf\"; filename*=UTF-8''Quotation-%E5%A0%B1%E5%83%B9-001.pdf"
    );
  });

  it("serves the second request from the cache", async () => {
    await get("12");
    const res = await get("12", "?download=1");
    expect(res.headers.get("x-pdf-cache")).toBe("hit");
    expect(mockRender).toHaveBeenCalledTimes(1);
    expect(Buffer.from(await res.arrayBuffer())).toEqual(Buffer.from(PDF));
  });

  it.each<[string, () => void, string, Record<string, string>]>([
    ["the quote was edited", () => mockLoad.mockResolvedValue(quote({ updatedAt: new Date("2026-10-09T04:00:00Z") })), "", {}],
    ["settings/branding changed", () => mockSettings.mockResolvedValue({ version: "v2", region: { timezone: "Asia/Taipei" }, quote: { defaultTaxRate: 5 } }), "", {}],
    ["another language is asked for", () => {}, "?lang=zh-TW", {}],
    ["the language cookie differs", () => {}, "", { cookie: "NEXT_LOCALE=zh-TW" }],
  ])("re-renders when %s", async (_label, change, query, headers) => {
    await get("12");
    change();
    const res = await get("12", query, headers);
    expect(res.headers.get("x-pdf-cache")).toBe("miss");
    expect(mockRender).toHaveBeenCalledTimes(2);
  });

  it("prefers ?lang over the cookie and ignores unknown languages", async () => {
    await get("12", "?lang=zh-TW", { cookie: "NEXT_LOCALE=en" });
    // same cache entry as the zh-TW cookie → hit
    expect((await get("12", "", { cookie: "NEXT_LOCALE=zh-TW" })).headers.get("x-pdf-cache")).toBe("hit");
    // unknown ?lang falls back to the cookie
    expect((await get("12", "?lang=fr", { cookie: "NEXT_LOCALE=zh-TW" })).headers.get("x-pdf-cache")).toBe("hit");
    // default (en) is a different entry
    expect((await get("12", "?lang=xx")).headers.get("x-pdf-cache")).toBe("miss");
  });

  it("does not cache quotes without updated_at", async () => {
    mockLoad.mockResolvedValue(quote({ updatedAt: null }));
    await get("12");
    const res = await get("12");
    expect(res.headers.get("x-pdf-cache")).toBe("miss");
    expect(mockRender).toHaveBeenCalledTimes(2);
  });

  it("answers 500 (no details) when rendering fails", async () => {
    mockRender.mockRejectedValueOnce(new Error("font file missing: /app/assets/fonts"));
    const res = await get("12");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "INTERNAL" });
  });
});
