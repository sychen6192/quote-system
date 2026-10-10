jest.mock("@/lib/auth/guard", () => ({
  assertAuthenticated: jest.fn(),
  isUnauthenticatedError: (e: unknown) => e instanceof Error && e.message === "UNAUTHENTICATED",
}));
jest.mock("@/services/settings", () => ({ getSettings: jest.fn() }));
jest.mock("@/services/quotes", () => ({ quoteExportBatches: jest.fn() }));

import { GET } from "@/app/api/export/quotes/route";
import { assertAuthenticated } from "@/lib/auth/guard";
import { csvEscape, exportFilename, quotesCsvStream, quotesToCsv, toCsv } from "@/services/export";
import { quoteExportBatches, type QuoteListItem } from "@/services/quotes";
import { getSettings } from "@/services/settings";
import type { NextRequest } from "next/server";
import { testSettings } from "../actions/helpers";

const BOM = "﻿";

function quote(overrides: Partial<QuoteListItem> = {}): QuoteListItem {
  return {
    id: 1,
    quotationNumber: "QT-20261009-001",
    customerId: 1,
    title: "Website, phase 2",
    salesperson: "Alice",
    issuedDate: "2026-10-09",
    validUntil: "2026-11-08",
    shippingDate: null,
    paymentMethod: "月結30天",
    shippingMethod: null,
    subtotal: 123456,
    discountType: "amount",
    discountValue: 0,
    discountAmount: 0,
    taxRate: 500,
    taxAmount: 6173,
    otherFees: 0,
    totalAmount: 129629,
    status: "sent",
    notes: null,
    terms: null,
    sentAt: null,
    decidedAt: null,
    createdAt: new Date("2026-10-09T02:00:00Z"),
    updatedAt: null,
    customer: {
      id: 1,
      companyName: '=HYPERLINK("http://evil")',
      contactPerson: 'Jane "JD" Doe',
      email: "jane@acme.test",
      phone: "+886-2-1234",
      address: null,
      vatNumber: "12345678",
      createdAt: null,
    },
    displayStatus: "sent",
    ...overrides,
  };
}

describe("csvEscape", () => {
  it.each([
    ["plain", "plain"],
    ["a,b", '"a,b"'],
    ['say "hi"', '"say ""hi"""'],
    ["line1\nline2", '"line1\nline2"'],
    ["=1+1", "'=1+1"],
    ["+886", "'+886"],
    ["-5", "'-5"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["\tcmd", "'\tcmd"],
    ['=HYPERLINK("x")', `"'=HYPERLINK(""x"")"`],
    ["中文，逗號", "中文，逗號"],
  ])("%p → %p", (input, output) => {
    expect(csvEscape(input)).toBe(output);
  });

  it("writes numbers, empties and trusted cells as-is", () => {
    expect(csvEscape(12.5)).toBe("12.5");
    expect(csvEscape(-3)).toBe("-3");
    expect(csvEscape(NaN)).toBe("");
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
    expect(csvEscape({ trusted: "-12.50" })).toBe("-12.50");
  });
});

describe("toCsv / exportFilename", () => {
  it("prefixes a UTF-8 BOM and joins records with CRLF", () => {
    expect(toCsv([["a", "b"], ["1", "x,y"]])).toBe(`${BOM}a,b\r\n1,"x,y"\r\n`);
  });

  it("names the file after the business date", () => {
    expect(exportFilename("2026-10-09")).toBe("quotes-20261009.csv");
  });
});

describe("quotesToCsv", () => {
  it("writes localised headers, guarded text and decimal money", () => {
    const csv = quotesToCsv([quote()], { locale: "zh-TW", currency: "USD", fractionDigits: 2 });
    expect(csv.startsWith(BOM)).toBe(true);
    const [header, row] = csv.slice(1).split("\r\n");
    expect(header.split(",").slice(0, 3)).toEqual(["報價單號", "主旨", "狀態"]);
    expect(row).toBe(
      [
        "QT-20261009-001",
        '"Website, phase 2"',
        "已發送",
        "2026-10-09",
        "2026-11-08",
        `"'=HYPERLINK(""http://evil"")"`,
        '"Jane ""JD"" Doe"',
        "jane@acme.test",
        "'+886-2-1234",
        "12345678",
        "Alice",
        "USD",
        "1234.56",
        "0.00",
        "61.73",
        "0.00",
        "1296.29",
        "月結30天",
        "",
        "",
      ].join(",")
    );
  });

  it("writes whole-unit amounts with the currency's fraction digits and labels expired quotes", () => {
    const csv = quotesToCsv(
      [
        quote({
          displayStatus: "expired",
          subtotal: 123400,
          discountAmount: 0,
          taxAmount: 6200,
          otherFees: -100,
          totalAmount: 129500,
        }),
      ],
      { locale: "en", currency: "TWD", fractionDigits: 0 }
    );
    const [header, row] = csv.slice(1).split("\r\n");
    expect(header.startsWith("Quote number,Title,Status")).toBe(true);
    expect(row).toContain(",Expired,");
    expect(row).toContain(",1234,0,62,-1,1295,");
  });

  it("keeps legacy cents that are not a whole displayed unit (TWD saved before 1.0.1)", () => {
    // 3 × NT$111 at 5%: tax stored unrounded as 16.65
    const legacy = quote({ subtotal: 33300, discountAmount: 0, taxAmount: 1665, otherFees: 0, totalAmount: 34965 });
    const [, row] = quotesToCsv([legacy], { locale: "en", currency: "TWD", fractionDigits: 0 }).slice(1).split("\r\n");
    // Each cell keeps its exact value, so the columns still add up.
    expect(row).toContain(",TWD,333,0,16.65,0,349.65,");

    const [, tenths] = quotesToCsv([quote({ subtotal: 1230, discountAmount: 5, taxAmount: 61, otherFees: 10, totalAmount: 1296 })], {
      locale: "en",
      currency: "XYZ",
      fractionDigits: 1,
    })
      .slice(1)
      .split("\r\n");
    expect(tenths).toContain(",XYZ,12.3,0.05,0.61,0.1,12.96,");
  });

  it("writes only the header for an empty export", () => {
    const csv = quotesToCsv([], { locale: "en", currency: "TWD", fractionDigits: 0 });
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(1);
  });
});

const exportBatches = quoteExportBatches as jest.Mock;

/** quoteExportBatches double: yields the given batches, then throws `fail` if set. */
function batchesOf(batches: QuoteListItem[][], fail?: Error) {
  return async function* () {
    for (const b of batches) yield b;
    if (fail) throw fail;
  };
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  // Keep the BOM (Response.text() strips it).
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(await new Response(stream).arrayBuffer());
}

describe("quotesCsvStream", () => {
  const options = { locale: "en" as const, currency: "TWD", fractionDigits: 0 };

  it("writes the BOM and header once, then every batch in order", async () => {
    const q = (n: number) => quote({ id: n, quotationNumber: `QT-${n}` });
    exportBatches.mockImplementation(batchesOf([[q(1), q(2)], [q(3), q(4)], [q(5)]]));
    const text = await readAll(await quotesCsvStream({}, options, { batchSize: 2 }));
    expect(text.startsWith(BOM)).toBe(true);
    expect(text.match(/Quote number/g)).toHaveLength(1);
    const lines = text.slice(1).split("\r\n").filter(Boolean);
    expect(lines.map((l) => l.split(",")[0])).toEqual(["Quote number", "QT-1", "QT-2", "QT-3", "QT-4", "QT-5"]);
    expect(exportBatches).toHaveBeenCalledWith({}, { batchSize: 2 });
  });

  it("is just the header when nothing matches", async () => {
    exportBatches.mockImplementation(batchesOf([]));
    const text = await readAll(await quotesCsvStream({}, options));
    expect(text.slice(1).split("\r\n").filter(Boolean)).toHaveLength(1);
  });

  it("rejects up front when the first batch fails", async () => {
    exportBatches.mockImplementation(batchesOf([], new Error("relation missing")));
    await expect(quotesCsvStream({}, options)).rejects.toThrow("relation missing");
  });

  it("errors the stream when a later batch fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    exportBatches.mockImplementation(batchesOf([[quote()]], new Error("connection lost")));
    await expect(readAll(await quotesCsvStream({}, options))).rejects.toThrow();
  });
});

describe("GET /api/export/quotes", () => {
  function request(url: string, cookie?: string): NextRequest {
    const parsed = new URL(url);
    return {
      nextUrl: parsed,
      cookies: { get: (name: string) => (name === "NEXT_LOCALE" && cookie ? { value: cookie } : undefined) },
    } as unknown as NextRequest;
  }

  beforeEach(() => {
    (assertAuthenticated as jest.Mock).mockResolvedValue(undefined);
    (getSettings as jest.Mock).mockResolvedValue(testSettings());
    exportBatches.mockImplementation(batchesOf([[quote({ subtotal: 123500, taxAmount: 6200, totalAmount: 129700 })]]));
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it("returns 401 when unauthenticated", async () => {
    (assertAuthenticated as jest.Mock).mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    const res = await GET(request("http://localhost/api/export/quotes"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "UNAUTHORIZED" });
    expect(exportBatches).not.toHaveBeenCalled();
  });

  it("streams a CSV attachment honouring the list filters", async () => {
    const res = await GET(
      request("http://localhost/api/export/quotes?q=acme&customer=Acme%20Corp&status=sent&sort=oldest&page=4", "zh-TW")
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="quotes-\d{8}\.csv"$/
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    const params = exportBatches.mock.calls[0][0];
    expect(params).toMatchObject({ q: "acme", customer: "Acme Corp", status: "sent", sort: "oldest" });
    expect(params.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const body = new Uint8Array(await res.arrayBuffer());
    expect([...body.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM
    const text = new TextDecoder().decode(body);
    expect(text).toContain("報價單號"); // NEXT_LOCALE cookie
    expect(text).toContain(",1235,0,62,0,1297,"); // TWD → no decimals
  });

  it("?lang= overrides the cookie", async () => {
    const res = await GET(request("http://localhost/api/export/quotes?lang=en", "zh-TW"));
    expect(await res.text()).toContain("Quote number");
  });

  it("returns 500 without details when the export fails", async () => {
    exportBatches.mockImplementation(batchesOf([], new Error("relation missing")));
    const res = await GET(request("http://localhost/api/export/quotes"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "INTERNAL" });
  });
});
