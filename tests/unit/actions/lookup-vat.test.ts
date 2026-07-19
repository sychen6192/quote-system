jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import { lookupVatNumber } from "@/actions/lookup-vat";

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
  delete process.env.TW_VAT_LOOKUP;
});

function mockFetchOnce(value: unknown, ok = true) {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok,
    json: async () => value,
  }) as unknown as typeof fetch;
}

describe("lookupVatNumber", () => {
  it("returns DISABLED when the flag is off (no fetch)", async () => {
    const spy = jest.fn();
    global.fetch = spy as unknown as typeof fetch;
    const res = await lookupVatNumber("22099131");
    expect(res).toEqual({ ok: false, reason: "DISABLED" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns INVALID for a non-8-digit VAT", async () => {
    process.env.TW_VAT_LOOKUP = "1";
    expect(await lookupVatNumber("123")).toEqual({
      ok: false,
      reason: "INVALID",
    });
    expect(await lookupVatNumber("abcdefgh")).toEqual({
      ok: false,
      reason: "INVALID",
    });
  });

  it("returns NOT_FOUND for an empty result set", async () => {
    process.env.TW_VAT_LOOKUP = "1";
    mockFetchOnce([]);
    expect(await lookupVatNumber("00000000")).toEqual({
      ok: false,
      reason: "NOT_FOUND",
    });
  });

  it("returns ok with the mapped company on success", async () => {
    process.env.TW_VAT_LOOKUP = "1";
    mockFetchOnce([
      {
        Company_Name: "台積電",
        Company_Location: "新竹",
        Responsible_Name: "魏",
        Company_Status_Desc: "核准設立",
      },
    ]);
    const res = await lookupVatNumber("22099131");
    expect(res).toEqual({
      ok: true,
      company: {
        companyName: "台積電",
        address: "新竹",
        responsibleName: "魏",
        status: "核准設立",
      },
    });
  });

  it("returns ERROR on non-2xx", async () => {
    process.env.TW_VAT_LOOKUP = "1";
    mockFetchOnce([], false);
    expect(await lookupVatNumber("22099131")).toEqual({
      ok: false,
      reason: "ERROR",
    });
  });

  it("returns ERROR when fetch throws", async () => {
    process.env.TW_VAT_LOOKUP = "1";
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error("net")) as unknown as typeof fetch;
    expect(await lookupVatNumber("22099131")).toEqual({
      ok: false,
      reason: "ERROR",
    });
  });
});
