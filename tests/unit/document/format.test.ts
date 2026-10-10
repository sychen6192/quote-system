import {
  amountInWords,
  displayedCents,
  formatAmount,
  formatDocumentDate,
  formatQuantity,
  formatRate,
  formatTotal,
  formatUnitPrice,
  present,
} from "@/components/quote-document/format";

const TWD = { currency: "TWD", currencyLocale: "zh-TW", fractionDigits: 0 };
const USD = { currency: "USD", currencyLocale: "en-US", fractionDigits: 2 };

describe("formatDocumentDate", () => {
  it("uses the numeric form for Chinese and a short month for English", () => {
    expect(formatDocumentDate("2026-10-09", "zh-TW")).toBe("2026/10/09");
    expect(formatDocumentDate("2026-10-09", "en")).toBe("Oct 9, 2026");
  });

  it("never shifts the calendar day", () => {
    expect(formatDocumentDate("2026-01-01", "en")).toBe("Jan 1, 2026");
    expect(formatDocumentDate("2026-12-31T23:59:59Z", "zh-TW")).toBe("2026/12/31");
  });

  it.each([null, undefined, "", "2026-02-30", "soon"])("returns '' for %p", (value) => {
    expect(formatDocumentDate(value, "en")).toBe("");
  });
});

describe("numbers", () => {
  it("trims quantities to at most 3 decimals", () => {
    expect(formatQuantity(1.5, "zh-TW")).toBe("1.5");
    expect(formatQuantity(12.125, "en")).toBe("12.125");
    expect(formatQuantity(3, "en")).toBe("3");
    expect(formatQuantity(1234.5, "en")).toBe("1,234.5");
    expect(formatQuantity(Number.NaN, "en")).toBe("0");
  });

  it("formats rates without a percent sign", () => {
    expect(formatRate(5, "en")).toBe("5");
    expect(formatRate(2.5, "zh-TW")).toBe("2.5");
  });

  it("formats table amounts without a currency symbol, totals with one", () => {
    expect(formatAmount(12345600, TWD)).toBe("123,456");
    expect(formatAmount(1050, USD)).toBe("10.50");
    expect(formatTotal(12345600, TWD)).toMatch(/^\$123,456$/);
    expect(formatTotal(1050, USD)).toBe("$10.50");
  });
});

describe("displayedCents", () => {
  it("rounds to the digits the currency shows", () => {
    expect(displayedCents(4950, 0)).toBe(5000);
    expect(displayedCents(4949, 0)).toBe(4900);
    expect(displayedCents(-4950, 0)).toBe(-5000);
    expect(displayedCents(1234, 1)).toBe(1230);
    expect(displayedCents(1234, 2)).toBe(1234);
  });
});

describe("amountInWords", () => {
  it("writes formal Chinese numerals for TWD, matching the rounded figure", () => {
    expect(amountInWords(30676875, TWD, "zh-TW")).toBe("新台幣參拾萬陸仟柒佰陸拾玖元整");
  });

  it("prefixes other currencies with their code", () => {
    expect(amountInWords(100000, USD, "zh-TW")).toBe("USD 壹仟元整");
    expect(amountInWords(123456, USD, "en")).toBe("USD One thousand two hundred thirty-four and 56/100 only");
  });
});

describe("present", () => {
  it("drops blank text", () => {
    expect(present("  ")).toBeNull();
    expect(present(null)).toBeNull();
    expect(present(" a ")).toBe("a");
  });
});

describe("formatUnitPrice", () => {
  it("keeps typed cents even when the currency shows no decimals", () => {
    expect(formatUnitPrice(1099, TWD)).toBe("10.99");
    expect(formatUnitPrice(1050, TWD)).toBe("10.5");
    expect(formatUnitPrice(8_000_000, TWD)).toBe("80,000");
  });

  it("follows the currency's digits for whole and fractional prices", () => {
    expect(formatUnitPrice(1000, USD)).toBe("10.00");
    expect(formatUnitPrice(1099, USD)).toBe("10.99");
  });
});
