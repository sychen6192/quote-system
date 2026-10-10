// Widths of the PDF items table's number columns, from the figures they
// hold. Pure (react-pdf has no auto table layout): fixed widths let a long
// unit price run into the amount next to it.
import { textWidthEm } from "./text-metrics";

/** Body font size of the items table (pt). */
export const TABLE_FONT_SIZE = 9;
/** Header font size (pt). */
export const TABLE_HEAD_FONT_SIZE = 7.5;
/** td/th paddingHorizontal (5pt) on both sides. */
export const CELL_PADDING = 10;
export const PRICE_COLUMN_MIN = 78;
export const AMOUNT_COLUMN_MIN = 84;
/** Past this the item column gets too narrow; the figures shrink instead. */
export const NUMBER_COLUMN_MAX = 124;
const MIN_FONT_SIZE = 6;

// Advance widths in Noto Sans TC (assets/fonts, measured with fontkit):
// digits are tabular, separators narrow. textWidthEm's 0.6 per character
// would widen ordinary columns for nothing.
const FIGURE_EM = {
  regular: { digit: 0.555, separator: 0.278, minus: 0.347 },
  bold: { digit: 0.59, separator: 0.325, minus: 0.37 },
} as const;
// Rounding and kerning slack.
const FIGURE_SLACK = 1.02;

/** Rendered width of a formatted figure ("1,234.50", "-13"), in ems. */
export function figureWidthEm(text: string, bold = false): number {
  const em = FIGURE_EM[bold ? "bold" : "regular"];
  let width = 0;
  for (const char of text) {
    if (char >= "0" && char <= "9") width += em.digit;
    else if (char === "," || char === "." || char === " ") width += em.separator;
    else if (char === "-" || char === "−") width += em.minus;
    else width += textWidthEm(char);
  }
  return width * FIGURE_SLACK;
}

export type NumberColumn = { width: number; fontSize: number };

function column(
  values: readonly string[],
  header: string,
  min: number,
  bold: boolean
): NumberColumn {
  const em = Math.max(0, ...values.map((value) => figureWidthEm(value, bold)));
  const needed = Math.max(
    Math.ceil(em * TABLE_FONT_SIZE),
    Math.ceil(textWidthEm(header) * TABLE_HEAD_FONT_SIZE)
  ) + CELL_PADDING;
  if (needed <= min) return { width: min, fontSize: TABLE_FONT_SIZE };
  if (needed <= NUMBER_COLUMN_MAX) return { width: needed, fontSize: TABLE_FONT_SIZE };
  // Still too wide at the cap: a smaller size for this column's figures.
  const fit = em > 0 ? (NUMBER_COLUMN_MAX - CELL_PADDING) / em : TABLE_FONT_SIZE;
  const fontSize = Math.max(MIN_FONT_SIZE, Math.min(TABLE_FONT_SIZE, Math.floor(fit * 10) / 10));
  return { width: NUMBER_COLUMN_MAX, fontSize };
}

/**
 * Unit price and amount columns wide enough for their longest formatted
 * figure (and header). Ordinary quotes keep the 78 / 84pt layout.
 */
export function numberColumnWidths(
  prices: readonly string[],
  amounts: readonly string[],
  headers: { price: string; amount: string } = { price: "", amount: "" }
): { price: NumberColumn; amount: NumberColumn } {
  return {
    price: column(prices, headers.price, PRICE_COLUMN_MIN, false),
    amount: column(amounts, headers.amount, AMOUNT_COLUMN_MIN, true),
  };
}
