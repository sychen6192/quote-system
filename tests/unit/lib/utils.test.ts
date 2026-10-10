import {
  TAX_RATE_SCALE,
  calculateQuoteFinancials,
  cn,
  formatCurrency,
  toBasisPoints,
  toPercentage,
} from "@/lib/utils";

describe("formatCurrency (wrapper over formatMoney)", () => {
  it("formats TWD in zh-TW with no decimals from cents", () => {
    expect(
      formatCurrency(123456, { currency: "TWD", currencyLocale: "zh-TW" })
    ).toBe("$1,235");
  });

  // Contract change (v1.0): fraction digits follow the currency, so USD keeps
  // its cents instead of rounding to whole dollars.
  it("formats USD in en-US with cents", () => {
    expect(
      formatCurrency(123456, { currency: "USD", currencyLocale: "en-US" })
    ).toBe("$1,234.56");
  });

  it("accepts an explicit fractionDigits", () => {
    expect(
      formatCurrency(123456, { currency: "USD", currencyLocale: "en-US", fractionDigits: 0 })
    ).toBe("$1,235");
  });

  it("falls back to plain text for invalid currency code", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      formatCurrency(200000, { currency: "NOPE!", currencyLocale: "zh-TW" })
    ).toBe("NOPE! 2000.00");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("legacy helpers", () => {
  it("keeps cn()", () => {
    expect(cn("p-2", "p-4", false && "hidden")).toBe("p-4");
  });

  it("keeps the basis-point helpers", () => {
    expect(TAX_RATE_SCALE).toBe(100);
    expect(toBasisPoints(5)).toBe(500);
    expect(toPercentage(500)).toBe(5);
  });

  it("keeps the 2-argument calculateQuoteFinancials shape", () => {
    expect(
      calculateQuoteFinancials(
        [
          { quantity: 2, unitPrice: 10000, isTaxable: true },
          { quantity: 1, unitPrice: 5000, isTaxable: false },
          { quantity: 1, unitPrice: 1000 },
        ],
        500
      )
    ).toEqual({ subtotal: 26000, taxAmount: 1050, totalAmount: 27050 });
  });
});
