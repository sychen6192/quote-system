import {
  calculateQuoteFinancials,
  currencyFractionDigits,
  formatMoney,
  lineAmount,
  toBasisPoints,
  toCents,
  toDecimalString,
  toPercentage,
  type MoneyItem,
  type QuoteFinancialsOptions,
} from "@/lib/money";

describe("currencyFractionDigits", () => {
  it.each([
    ["TWD", 0],
    ["twd", 0],
    ["JPY", 0],
    ["KRW", 0],
    ["VND", 0],
    ["CLP", 0],
    ["ISK", 0],
    ["HUF", 0],
    ["UGX", 0],
    ["USD", 2],
    ["EUR", 2],
    ["BHD", 3],
    ["NOPE!", 2],
    ["", 2],
  ])("%s → %i", (currency, digits) => {
    expect(currencyFractionDigits(currency)).toBe(digits);
  });
});

describe("toCents / basis points", () => {
  it.each([
    [0, 0],
    [1, 100],
    [10.5, 1050],
    [0.29, 29],
    [1.15, 115],
    [19.99, 1999],
    [1e12, 1e14],
    [NaN, 0],
    [Infinity, 0],
  ])("toCents(%p) = %p", (major, cents) => {
    expect(toCents(major)).toBe(cents);
  });

  it("never returns -0", () => {
    expect(Object.is(toCents(-0.001), -0)).toBe(false);
  });

  it("converts percent ↔ basis points", () => {
    expect(toBasisPoints(5)).toBe(500);
    expect(toBasisPoints(12.5)).toBe(1250);
    expect(toBasisPoints(0.01)).toBe(1);
    expect(toPercentage(500)).toBe(5);
    expect(toPercentage(1250)).toBe(12.5);
  });
});

describe("lineAmount", () => {
  it.each([
    [2, 10000, 20000],
    [1.5, 333, 500], // 499.5 rounds half up
    [0.333, 100, 33], // 33.3
    [0.1, 30, 3], // float 3.0000000000000004
    [3, 0, 0],
    [1e9, 1, 1e9],
  ])("lineAmount(%p, %p) = %p", (qty, price, amount) => {
    expect(lineAmount(qty, price)).toBe(amount);
  });

  // Exact half-cent products that binary floats land just below
  // (0.145 × 100 = 14.499999999999998).
  it.each([
    [0.145, 100, 15],
    [0.285, 100, 29],
    [0.29, 50, 15],
    [0.41, 150, 62],
    [0.565, 100, 57],
    [2.675, 100, 268],
    [1.005, 1000, 1005],
  ])("rounds the exact half-cent product half up: lineAmount(%p, %p) = %p", (qty, price, amount) => {
    expect(lineAmount(qty, price)).toBe(amount);
  });

  it("matches exact half-up rounding for every 3-decimal quantity", () => {
    for (let milli = 1; milli <= 20_000; milli++) {
      const quantity = Number((milli / 1000).toFixed(3));
      for (const price of [1, 7, 50, 99, 150, 333, 12_345]) {
        const exact = Math.floor((milli * price * 2 + 1000) / 2000);
        expect(lineAmount(quantity, price)).toBe(exact);
      }
    }
  });

  it("falls back to plain rounding for quantities with more decimals", () => {
    expect(lineAmount(0.3333, 300)).toBe(100); // 99.99
    expect(lineAmount(-1.5, 333)).toBe(-500);
  });
});

const item = (quantity: number, unitPrice: number, isTaxable?: boolean | null): MoneyItem => ({
  quantity,
  unitPrice,
  isTaxable,
});

describe("calculateQuoteFinancials", () => {
  const cases: {
    name: string;
    items: MoneyItem[];
    options: QuoteFinancialsOptions;
    expected: Partial<ReturnType<typeof calculateQuoteFinancials>>;
  }[] = [
    {
      name: "simple 5% tax",
      items: [item(2, 10000)],
      options: { taxRateBp: 500 },
      expected: { subtotal: 20000, taxableSubtotal: 20000, discount: 0, taxBase: 20000, tax: 1000, otherFees: 0, total: 21000 },
    },
    {
      name: "isTaxable null/undefined counts as taxable",
      items: [item(1, 1000, null), item(1, 1000)],
      options: { taxRateBp: 500 },
      expected: { taxableSubtotal: 2000, tax: 100, total: 2100 },
    },
    {
      name: "mixed taxable / untaxed",
      items: [item(1, 10000, true), item(1, 5000, false)],
      options: { taxRateBp: 500 },
      expected: { subtotal: 15000, taxableSubtotal: 10000, tax: 500, total: 15500 },
    },
    {
      name: "all untaxed",
      items: [item(3, 1000, false)],
      options: { taxRateBp: 500 },
      expected: { subtotal: 3000, taxableSubtotal: 0, taxBase: 0, tax: 0, total: 3000 },
    },
    {
      name: "zero subtotal with a discount and fees",
      items: [item(1, 0)],
      options: { taxRateBp: 500, discount: { type: "amount", value: 500 }, otherFees: 300 },
      expected: { subtotal: 0, discount: 0, taxBase: 0, tax: 0, otherFees: 300, total: 300 },
    },
    {
      name: "no items",
      items: [],
      options: { taxRateBp: 500 },
      expected: { subtotal: 0, tax: 0, total: 0 },
    },
    {
      name: "amount discount reduces the tax base",
      items: [item(1, 10000)],
      options: { taxRateBp: 500, discount: { type: "amount", value: 2000 } },
      expected: { discount: 2000, taxBase: 8000, tax: 400, total: 8400 },
    },
    {
      name: "percent discount (10%)",
      items: [item(1, 10000)],
      options: { taxRateBp: 500, discount: { type: "percent", value: 1000 } },
      expected: { discount: 1000, taxBase: 9000, tax: 450, total: 9450 },
    },
    {
      name: "percent discount rounds half up (12.5% of 333)",
      items: [item(1, 333)],
      options: { taxRateBp: 0, discount: { type: "percent", value: 1250 } },
      expected: { discount: 42, total: 291 },
    },
    {
      name: "discount above the subtotal is clamped",
      items: [item(1, 1000)],
      options: { taxRateBp: 500, discount: { type: "amount", value: 999999 } },
      expected: { discount: 1000, taxBase: 0, tax: 0, total: 0 },
    },
    {
      name: "percent discount above 100% is clamped",
      items: [item(1, 1000)],
      options: { taxRateBp: 500, discount: { type: "percent", value: 15000 } },
      expected: { discount: 1000, total: 0 },
    },
    {
      name: "negative discount is clamped to 0",
      items: [item(1, 1000)],
      options: { taxRateBp: 0, discount: { type: "amount", value: -500 } },
      expected: { discount: 0, total: 1000 },
    },
    {
      name: "discount is shared pro rata with untaxed lines",
      items: [item(1, 6000, true), item(1, 4000, false)],
      options: { taxRateBp: 1000, discount: { type: "amount", value: 1000 } },
      // taxable share of discount = 1000 × 6000 / 10000 = 600
      expected: { discount: 1000, taxBase: 5400, tax: 540, total: 9540 },
    },
    {
      name: "pro-rata share rounds half up",
      items: [item(1, 1, true), item(1, 1, false)],
      options: { taxRateBp: 0, discount: { type: "amount", value: 1 } },
      // 1 × 1 / 2 = 0.5 → 1
      expected: { taxBase: 0 },
    },
    {
      name: "tax rounds half up (5% of 10 cents = 0.5)",
      items: [item(1, 10)],
      options: { taxRateBp: 500 },
      expected: { tax: 1, total: 11 },
    },
    {
      name: "tax just below half rounds down (5% of 9 = 0.45)",
      items: [item(1, 9)],
      options: { taxRateBp: 500 },
      expected: { tax: 0, total: 9 },
    },
    {
      name: "other fees are added after tax and never taxed",
      items: [item(1, 10000)],
      options: { taxRateBp: 500, otherFees: 1500 },
      expected: { tax: 500, otherFees: 1500, total: 12000 },
    },
    {
      name: "fractional quantities round per line",
      items: [item(1.5, 333), item(0.333, 100)],
      options: { taxRateBp: 0 },
      expected: { subtotal: 533 },
    },
    {
      name: "100% tax rate",
      items: [item(1, 1234)],
      options: { taxRateBp: 10000 },
      expected: { tax: 1234, total: 2468 },
    },
    {
      name: "big numbers (1e12 cents) stay exact",
      items: [item(1, 1e12), item(3, 1e12, false)],
      options: { taxRateBp: 500, discount: { type: "percent", value: 333 }, otherFees: 99 },
      // discount = 4e12 × 3.33% = 133_200_000_000; taxable share = 33_300_000_000
      expected: {
        subtotal: 4e12,
        discount: 133_200_000_000,
        taxBase: 966_700_000_000,
        tax: 48_335_000_000,
        total: 4e12 - 133_200_000_000 + 48_335_000_000 + 99,
      },
    },
    {
      name: "huge amount × percent beyond 2^53 is still exact",
      items: [item(1, 9_007_199_254_740)],
      options: { taxRateBp: 0, discount: { type: "percent", value: 9999 } },
      // 9_007_199_254_740 × 9999 / 10000 = 9_006_298_534_814.526 → …815
      expected: { discount: 9_006_298_534_815 },
    },
    {
      name: "non-finite inputs count as zero",
      items: [item(NaN, 100), item(1, Infinity)],
      options: { taxRateBp: NaN, discount: { type: "amount", value: NaN }, otherFees: NaN },
      expected: { subtotal: 0, discount: 0, tax: 0, otherFees: 0, total: 0 },
    },
  ];

  it.each(cases)("$name", ({ items, options, expected }) => {
    expect(calculateQuoteFinancials(items, options)).toMatchObject(expected);
  });

  it("total always equals subtotal − discount + tax + otherFees", () => {
    for (const { items, options } of cases) {
      const f = calculateQuoteFinancials(items, options);
      expect(f.total).toBe(f.subtotal - f.discount + f.tax + f.otherFees);
      expect(Number.isInteger(f.total)).toBe(true);
    }
  });
});

describe("toDecimalString", () => {
  it.each([
    [123456, 2, "1234.56"],
    [123450, 2, "1234.50"],
    [5, 2, "0.05"],
    [123456, 0, "1235"],
    [123449, 0, "1234"],
    [50, 0, "1"],
    [-123456, 2, "-1234.56"],
    [-150, 0, "-2"],
    [123456, 3, "1234.560"],
    [123455, 1, "1234.6"],
    [0, 2, "0.00"],
    [1e14, 2, "1000000000000.00"],
  ])("toDecimalString(%p, %p) = %p", (cents, digits, text) => {
    expect(toDecimalString(cents, digits)).toBe(text);
  });
});

describe("formatMoney", () => {
  it("formats TWD with no decimals (rounded)", () => {
    expect(formatMoney(123456, { currency: "TWD", currencyLocale: "zh-TW" })).toBe("$1,235");
  });

  it("formats USD with cents by default", () => {
    expect(formatMoney(123456, { currency: "USD", currencyLocale: "en-US" })).toBe("$1,234.56");
    expect(formatMoney(1050, { currency: "USD", currencyLocale: "en-US" })).toBe("$10.50");
  });

  it("honours an explicit fractionDigits", () => {
    expect(
      formatMoney(123456, { currency: "USD", currencyLocale: "en-US", fractionDigits: 0 })
    ).toBe("$1,235");
    expect(
      formatMoney(123400, { currency: "TWD", currencyLocale: "zh-TW", fractionDigits: 2 })
    ).toBe("$1,234.00");
  });

  it("uses the money locale, not the UI locale", () => {
    expect(formatMoney(123456, { currency: "EUR", currencyLocale: "de-DE" })).toMatch(
      /^1\.234,56\s€$/
    );
  });

  it("falls back to plain text for an invalid currency", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(formatMoney(200000, { currency: "NOPE!", currencyLocale: "zh-TW" })).toBe(
      "NOPE! 2000.00"
    );
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("treats non-finite input as zero", () => {
    expect(formatMoney(NaN, { currency: "TWD", currencyLocale: "zh-TW" })).toBe("$0");
  });
});
