import { formatCurrency } from "@/lib/utils";

describe("formatCurrency", () => {
  it("formats TWD in zh-TW with no decimals from cents", () => {
    expect(
      formatCurrency(123456, { currency: "TWD", currencyLocale: "zh-TW" })
    ).toBe("$1,235");
  });

  it("formats USD in en-US", () => {
    expect(
      formatCurrency(123456, { currency: "USD", currencyLocale: "en-US" })
    ).toBe("$1,235");
  });

  it("falls back to plain text for invalid currency code", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      formatCurrency(200000, { currency: "NOPE!", currencyLocale: "zh-TW" })
    ).toBe("NOPE! 2000");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
