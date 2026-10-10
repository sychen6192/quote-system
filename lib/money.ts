// Money rules (spec §4). Every amount is integer "cents" (major × 100) for
// every currency; tax rates and percentage discounts are basis points
// (500 = 5.00 %). Pure and client-safe: the form preview, the server actions
// and the PDF all call the same functions, so they cannot drift apart.

export type DiscountType = "amount" | "percent";

export type MoneyItem = {
  quantity: number;
  /** cents */
  unitPrice: number;
  /** null/undefined counts as taxable (the DB default) */
  isTaxable?: boolean | null;
};

export type QuoteFinancialsOptions = {
  taxRateBp: number;
  /** value: cents for "amount", basis points for "percent" */
  discount?: { type: DiscountType; value: number } | null;
  /** cents, untaxed, added after tax */
  otherFees?: number | null;
  /**
   * Cents per displayed unit: minorUnitStep(fractionDigits) of the configured
   * currency (100 for TWD). Line amounts, discount, tax and fees are rounded
   * to it so the printed figures add up. Omitted: plain cents.
   */
  minorUnitStep?: number;
};

export type QuoteFinancials = {
  subtotal: number;
  taxableSubtotal: number;
  /** clamped to [0, subtotal] */
  discount: number;
  taxBase: number;
  tax: number;
  otherFees: number;
  total: number;
};

export type MoneyFormat = {
  currency: string;
  currencyLocale: string;
  /** defaults to currencyFractionDigits(currency) */
  fractionDigits?: number;
};

/** 1 % = 100 basis points */
export const BASIS_POINTS_PER_PERCENT = 100;

// Currencies whose minor unit is not used in practice even though ISO 4217
// (and therefore Intl) says otherwise, e.g. NT$ prices are always whole.
const ZERO_DECIMAL_CURRENCIES = new Set([
  "TWD",
  "JPY",
  "KRW",
  "VND",
  "CLP",
  "ISK",
  "HUF",
  "UGX",
]);

export function currencyFractionDigits(currency: string): number {
  const code = (currency || "").trim().toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  try {
    const digits = new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
    }).resolvedOptions().maximumFractionDigits;
    return typeof digits === "number" ? digits : 2;
  } catch {
    return 2;
  }
}

/** Major units → cents. Inputs are validated to ≤ 2 decimals upstream. */
export function toCents(major: number): number {
  if (!Number.isFinite(major)) return 0;
  return Math.round(major * 100) || 0;
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function toBasisPoints(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.round(percent * BASIS_POINTS_PER_PERCENT) || 0;
}

export function toPercentage(bp: number): number {
  return bp / BASIS_POINTS_PER_PERCENT;
}

function int(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value) || 0
    : 0;
}

/**
 * round(a × b / c) with exact integer arithmetic, half away from zero.
 * Plain floats lose precision once a × b passes 2^53 (≈ NT$90 billion ×
 * 10 000 bp), which a 1e12-cent quote reaches.
 */
function mulDivRound(a: number, b: number, c: number): number {
  if (c === 0 || a === 0 || b === 0) return 0;
  const negative = (a < 0) !== (b < 0) !== (c < 0);
  const num = BigInt(Math.abs(a)) * BigInt(Math.abs(b));
  const den = BigInt(Math.abs(c));
  const q = (num * BigInt(2) + den) / (den * BigInt(2));
  const result = Number(q);
  return negative ? -result : result;
}

/**
 * Cents per displayed unit for a currency shown with `fractionDigits`
 * decimals: 100 for 0 (TWD, JPY), 10 for 1, else 1.
 */
export function minorUnitStep(fractionDigits: number): number {
  if (fractionDigits === 0) return 100;
  if (fractionDigits === 1) return 10;
  return 1;
}

function validStep(step: number | undefined): number {
  return step === 10 || step === 100 ? step : 1;
}

/** `cents` rounded half away from zero to a multiple of `step` (1, 10 or 100). */
export function roundToStep(cents: number, step: number): number {
  const s = validStep(step);
  const value = int(cents);
  if (s === 1) return value;
  return mulDivRound(value, 1, s) * s || 0;
}

/**
 * Line amount in cents = round(quantity × unit price), half away from zero,
 * then to the currency's displayed unit when `step` is given.
 * Quantities have at most 3 decimals, so the product is computed exactly in
 * thousandths: 0.145 × 100 is 14.4999… in binary and would round to 14.
 */
export function lineAmount(quantity: number, unitPriceCents: number, step?: number): number {
  const q = Number.isFinite(quantity) ? quantity : 0;
  const p = Number.isFinite(unitPriceCents) ? unitPriceCents : 0;
  const milli = Math.round(q * 1000);
  const cents =
    Number.isSafeInteger(p) && Number.isSafeInteger(milli) && Number(q.toFixed(3)) === q
      ? mulDivRound(milli, p, 1000) || 0
      : Math.round(q * p) || 0;
  return step === undefined ? cents : roundToStep(cents, step);
}

/**
 * With a `minorUnitStep`, every printed figure (line amounts, discount, tax,
 * fees) is rounded to that unit first, and subtotal and total are sums of the
 * rounded figures, so the document adds up as printed (Taiwan's 營業稅 is
 * whole dollars too). Unit prices keep their cents. The tax base is an
 * intermediate value and stays unrounded.
 */
export function calculateQuoteFinancials(
  items: readonly MoneyItem[],
  { taxRateBp, discount, otherFees, minorUnitStep: rawStep }: QuoteFinancialsOptions
): QuoteFinancials {
  const step = validStep(rawStep);
  let subtotal = 0;
  let taxableSubtotal = 0;
  for (const item of items) {
    const amount = lineAmount(item.quantity, item.unitPrice, step);
    subtotal += amount;
    if (item.isTaxable ?? true) taxableSubtotal += amount;
  }

  const rawDiscount = roundToStep(
    discount?.type === "percent"
      ? mulDivRound(subtotal, int(discount.value), 10_000)
      : int(discount?.value),
    step
  );
  const discountAmount = Math.min(Math.max(rawDiscount, 0), Math.max(subtotal, 0));

  // The discount is spread over taxable and untaxed lines in proportion,
  // so only the taxable share reduces the tax base.
  const taxBase =
    taxableSubtotal -
    (subtotal > 0 ? mulDivRound(discountAmount, taxableSubtotal, subtotal) : 0);
  const tax = roundToStep(mulDivRound(taxBase, int(taxRateBp), 10_000), step);
  const fees = roundToStep(int(otherFees), step);

  return {
    subtotal,
    taxableSubtotal,
    discount: discountAmount,
    taxBase,
    tax,
    otherFees: fees,
    total: subtotal - discountAmount + tax + fees,
  };
}

const formatters = new Map<string, Intl.NumberFormat>();

function currencyFormatter(
  currency: string,
  currencyLocale: string,
  fractionDigits: number
): Intl.NumberFormat {
  const key = `${currencyLocale}|${currency}|${fractionDigits}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(currencyLocale, {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

function resolveDigits(currency: string, fractionDigits?: number): number {
  return typeof fractionDigits === "number" &&
    Number.isInteger(fractionDigits) &&
    fractionDigits >= 0 &&
    fractionDigits <= 4
    ? fractionDigits
    : currencyFractionDigits(currency);
}

/**
 * Cents → plain decimal string with a dot and no grouping ("1234.50",
 * "1235"), rounded half away from zero. Used for CSV and inputs.
 */
export function toDecimalString(cents: number, fractionDigits = 2): string {
  const value = int(cents);
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const digits = Math.min(Math.max(Math.trunc(fractionDigits) || 0, 0), 4);
  if (digits === 0) return `${sign}${Math.floor((abs + 50) / 100)}`;
  if (digits === 1) {
    const tenths = Math.floor((abs + 5) / 10);
    return `${sign}${Math.floor(tenths / 10)}.${tenths % 10}`;
  }
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0").padEnd(digits, "0");
  return `${sign}${whole}.${frac}`;
}

/**
 * The one money formatter (spec §4): currency symbol and grouping come from
 * the configured money locale, never from the UI locale.
 */
export function formatMoney(cents: number, format: MoneyFormat): string {
  const digits = resolveDigits(format.currency, format.fractionDigits);
  const value = Number.isFinite(cents) ? cents : 0;
  try {
    return currencyFormatter(
      format.currency,
      format.currencyLocale,
      digits
    ).format(value / 100);
  } catch (error) {
    console.warn("formatMoney: invalid currency config", format, error);
    return `${format.currency} ${toDecimalString(value, digits)}`;
  }
}
