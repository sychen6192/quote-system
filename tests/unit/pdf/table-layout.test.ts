import {
  AMOUNT_COLUMN_MIN,
  CELL_PADDING,
  NUMBER_COLUMN_MAX,
  PRICE_COLUMN_MIN,
  figureWidthEm,
  numberColumnWidths,
} from "@/components/pdf/table-layout";

const fits = (value: string, column: { width: number; fontSize: number }, bold = false) =>
  column.width - CELL_PADDING >= figureWidthEm(value, bold) * column.fontSize;

describe("figureWidthEm", () => {
  // Noto Sans TC advance widths: 0.555em digits, 0.278em separators (regular).
  it("measures digits and separators like the PDF font", () => {
    expect(figureWidthEm("987,654,321,012.34")).toBeGreaterThanOrEqual(8.88);
    expect(figureWidthEm("987,654,321,012.34")).toBeLessThan(9.2);
    expect(figureWidthEm("15,000,000,000.00", true)).toBeGreaterThan(figureWidthEm("15,000,000,000.00"));
  });
});

describe("numberColumnWidths", () => {
  it("keeps the usual 78 / 84pt columns for ordinary figures", () => {
    const out = numberColumnWidths(["1,234,567.89", "10.5"], ["1,234,567,890"], {
      price: "Unit price",
      amount: "Amount",
    });
    expect(out.price).toEqual({ width: PRICE_COLUMN_MIN, fontSize: 9 });
    expect(out.amount).toEqual({ width: AMOUNT_COLUMN_MIN, fontSize: 9 });
  });

  // 987,654,321,012.34 next to 987,654,321,012 printed as one fused number.
  it.each(["987,654,321,012.34", "15,000,000,000.00", "15,000,000,000.25"])(
    "widens the columns so %s fits inside its padding",
    (value) => {
      const out = numberColumnWidths([value], [value]);
      expect(fits(value, out.price)).toBe(true);
      expect(fits(value, out.amount, true)).toBe(true);
      expect(out.price.width).toBeGreaterThan(PRICE_COLUMN_MIN);
      expect(out.amount.width).toBeGreaterThan(AMOUNT_COLUMN_MIN);
    }
  );

  it("fits the largest total the schema allows without shrinking", () => {
    // MAX_SAFE_INTEGER cents
    const max = "90,071,992,547,409.91";
    const out = numberColumnWidths([max], [max]);
    expect(out.price.fontSize).toBe(9);
    expect(out.amount.fontSize).toBe(9);
    expect(fits(max, out.price)).toBe(true);
    expect(fits(max, out.amount, true)).toBe(true);
  });

  it("caps the width and shrinks the type past that", () => {
    const huge = "1,000,000,000,000,000,000,000.00";
    const out = numberColumnWidths([huge], [huge]);
    expect(out.price.width).toBe(NUMBER_COLUMN_MAX);
    expect(out.price.fontSize).toBeLessThan(9);
    expect(fits(huge, out.price)).toBe(true);
    expect(out.amount.width).toBe(NUMBER_COLUMN_MAX);
    expect(fits(huge, out.amount, true)).toBe(true);
  });

  it("makes room for a long header label", () => {
    const out = numberColumnWidths(["1"], ["1"], { price: "Unit price excl. tax (TWD)", amount: "" });
    expect(out.price.width).toBeGreaterThan(PRICE_COLUMN_MIN);
  });

  it("handles an empty table", () => {
    expect(numberColumnWidths([], [])).toEqual({
      price: { width: PRICE_COLUMN_MIN, fontSize: 9 },
      amount: { width: AMOUNT_COLUMN_MIN, fontSize: 9 },
    });
  });
});
