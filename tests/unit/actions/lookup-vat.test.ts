jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("next/headers", () => ({ headers: jest.fn() }));
jest.mock("@/lib/auth/guard", () => ({
  assertAuthenticated: jest.fn(),
  isUnauthenticatedError: (e: unknown) => e instanceof Error && e.message === "UNAUTHENTICATED",
}));
jest.mock("@/services/settings", () => ({ getSettings: jest.fn() }));

import { headers } from "next/headers";
import { lookupVatNumber } from "@/actions/lookup-vat";
import { assertAuthenticated } from "@/lib/auth/guard";
import { getSettings } from "@/services/settings";
import { testSettings } from "./helpers";

const realFetch = global.fetch;
const mockAuth = assertAuthenticated as jest.Mock;
const mockSettings = getSettings as jest.Mock;
let ip = 0;

function enableLookup(enabled = true) {
  mockSettings.mockResolvedValue(testSettings({ features: { twVatLookup: enabled } }));
}

beforeEach(() => {
  ip += 1;
  (headers as jest.Mock).mockResolvedValue(new Headers({ "x-forwarded-for": `10.1.0.${ip}` }));
  mockAuth.mockResolvedValue(undefined);
  enableLookup(false);
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  global.fetch = realFetch;
  jest.restoreAllMocks();
});

function mockFetchOnce(value: unknown, ok = true) {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok,
    json: async () => value,
  }) as unknown as typeof fetch;
}

describe("lookupVatNumber", () => {
  it("returns UNAUTHORIZED before anything else", async () => {
    mockAuth.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    const spy = jest.fn();
    global.fetch = spy as unknown as typeof fetch;
    expect(await lookupVatNumber("22099131")).toEqual({ success: false, code: "UNAUTHORIZED" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns DISABLED when the setting is off (no fetch)", async () => {
    const spy = jest.fn();
    global.fetch = spy as unknown as typeof fetch;
    expect(await lookupVatNumber("22099131")).toEqual({ success: false, code: "DISABLED" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns INVALID for a non-8-digit VAT", async () => {
    enableLookup();
    expect(await lookupVatNumber("123")).toEqual({ success: false, code: "INVALID" });
    expect(await lookupVatNumber("abcdefgh")).toEqual({ success: false, code: "INVALID" });
    expect(await lookupVatNumber(12345678)).toEqual({ success: false, code: "INVALID" });
  });

  it("returns NOT_FOUND for an empty result set", async () => {
    enableLookup();
    mockFetchOnce([]);
    expect(await lookupVatNumber("00000000")).toEqual({ success: false, code: "NOT_FOUND" });
  });

  it("returns the mapped company on success", async () => {
    enableLookup();
    mockFetchOnce([
      {
        Company_Name: "台積電",
        Company_Location: "新竹",
        Responsible_Name: "魏",
        Company_Status_Desc: "核准設立",
      },
    ]);
    expect(await lookupVatNumber(" 22099131 ")).toEqual({
      success: true,
      company: {
        companyName: "台積電",
        address: "新竹",
        responsibleName: "魏",
        status: "核准設立",
      },
    });
  });

  it("returns ERROR on non-2xx", async () => {
    enableLookup();
    mockFetchOnce([], false);
    expect(await lookupVatNumber("22099131")).toEqual({ success: false, code: "ERROR" });
  });

  it("returns ERROR (not the raw error) when settings cannot be loaded", async () => {
    mockSettings.mockRejectedValueOnce(new Error("connect ECONNREFUSED 10.0.0.5:5432"));
    expect(await lookupVatNumber("22099131")).toEqual({ success: false, code: "ERROR" });
    expect(console.error).toHaveBeenCalled();
  });

  it("returns ERROR when fetch throws", async () => {
    enableLookup();
    global.fetch = jest.fn().mockRejectedValueOnce(new Error("net")) as unknown as typeof fetch;
    expect(await lookupVatNumber("22099131")).toEqual({ success: false, code: "ERROR" });
  });

  it("rate-limits to 30 lookups per minute per IP", async () => {
    enableLookup();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] }) as unknown as typeof fetch;
    for (let i = 0; i < 30; i++) {
      expect(await lookupVatNumber("22099131")).toEqual({ success: false, code: "NOT_FOUND" });
    }
    expect(await lookupVatNumber("22099131")).toEqual({ success: false, code: "RATE_LIMITED" });
    expect(global.fetch).toHaveBeenCalledTimes(30);
  });
});
