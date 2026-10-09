jest.mock("@/lib/auth/guard", () => ({
  assertAuthenticated: jest.fn(),
  isUnauthenticatedError: (e: unknown) => e instanceof Error && e.message === "UNAUTHENTICATED",
}));
jest.mock("@/services/settings", () => ({ getSettings: jest.fn() }));
jest.mock("@/services/quotes", () => ({ listQuotesForExport: jest.fn() }));

import { GET } from "@/app/api/export/quotes/route";
import { assertAuthenticated } from "@/lib/auth/guard";
import { csvEscape, exportFilename, quotesToCsv, toCsv } from "@/services/export";
import { listQuotesForExport, type QuoteListItem } from "@/services/quotes";
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
    createdAt: null,
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

  it("rounds to the currency's fraction digits and labels expired quotes", () => {
    const csv = quotesToCsv([quote({ displayStatus: "expired" })], {
      locale: "en",
      currency: "TWD",
      fractionDigits: 0,
    });
    const [header, row] = csv.slice(1).split("\r\n");
    expect(header.startsWith("Quote number,Title,Status")).toBe(true);
    expect(row).toContain(",Expired,");
    expect(row).toContain(",1235,0,62,0,1296,");
  });

  it("writes only the header for an empty export", () => {
    const csv = quotesToCsv([], { locale: "en", currency: "TWD", fractionDigits: 0 });
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(1);
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
    (listQuotesForExport as jest.Mock).mockResolvedValue([quote()]);
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it("returns 401 when unauthenticated", async () => {
    (assertAuthenticated as jest.Mock).mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    const res = await GET(request("http://localhost/api/export/quotes"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "UNAUTHORIZED" });
    expect(listQuotesForExport).not.toHaveBeenCalled();
  });

  it("streams a CSV attachment honouring the list filters", async () => {
    const res = await GET(
      request("http://localhost/api/export/quotes?q=acme&status=sent&sort=oldest&page=4", "zh-TW")
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="quotes-\d{8}\.csv"$/
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
    const params = (listQuotesForExport as jest.Mock).mock.calls[0][0];
    expect(params).toMatchObject({ q: "acme", status: "sent", sort: "oldest" });
    expect(params.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const body = new Uint8Array(await res.arrayBuffer());
    expect([...body.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM
    const text = new TextDecoder().decode(body);
    expect(text).toContain("報價單號"); // NEXT_LOCALE cookie
    expect(text).toContain(",1235,"); // TWD → no decimals
  });

  it("?lang= overrides the cookie", async () => {
    const res = await GET(request("http://localhost/api/export/quotes?lang=en", "zh-TW"));
    expect(await res.text()).toContain("Quote number");
  });

  it("returns 500 without details when the export fails", async () => {
    (listQuotesForExport as jest.Mock).mockRejectedValueOnce(new Error("relation missing"));
    const res = await GET(request("http://localhost/api/export/quotes"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "INTERNAL" });
  });
});
