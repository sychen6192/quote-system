// Formatting shared by the HTML document, the PDF and the email. Pure and
// client-safe. Calendar dates are "YYYY-MM-DD" strings that are already in
// the business timezone, so they are formatted in UTC: no browser or server
// offset can move them to another day.
import { amountInWordsEn, amountInWordsZhTW } from "@/lib/amount-in-words";
import { isIsoDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export type DocumentMoney = {
  currency: string;
  currencyLocale: string;
  fractionDigits: number;
};

export function isChineseLocale(locale: string): boolean {
  return locale.toLowerCase().startsWith("zh");
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();

/** "2026/10/09" (Taiwanese documents use the numeric form) or "Oct 9, 2026"; "" when invalid. */
export function formatDocumentDate(iso: string | null | undefined, locale: string): string {
  const day = iso?.slice(0, 10);
  if (!day || !isIsoDate(day)) return "";
  const zh = isChineseLocale(locale);
  const key = `${locale}|${zh}`;
  let format = dateFormats.get(key);
  if (!format) {
    try {
      format = new Intl.DateTimeFormat(
        locale,
        zh
          ? { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" }
          : { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }
      );
    } catch {
      return day;
    }
    dateFormats.set(key, format);
  }
  return format.format(new Date(`${day}T00:00:00Z`));
}

const numberFormats = new Map<string, Intl.NumberFormat>();

function numberFormat(locale: string, min: number, max: number): Intl.NumberFormat {
  const key = `${locale}|${min}|${max}`;
  let format = numberFormats.get(key);
  if (!format) {
    try {
      format = new Intl.NumberFormat(locale, {
        minimumFractionDigits: min,
        maximumFractionDigits: max,
      });
    } catch {
      format = new Intl.NumberFormat("en", { minimumFractionDigits: min, maximumFractionDigits: max });
    }
    numberFormats.set(key, format);
  }
  return format;
}

/** Quantities have up to 3 decimals; trailing zeros are dropped (1.500 → "1.5"). */
export function formatQuantity(quantity: number, locale: string): string {
  return numberFormat(locale, 0, 3).format(Number.isFinite(quantity) ? quantity : 0);
}

/** A percentage without the sign: 5 → "5", 2.5 → "2.5". */
export function formatRate(percent: number, locale: string): string {
  return numberFormat(locale, 0, 2).format(Number.isFinite(percent) ? percent : 0);
}

/** Cents as a plain amount in the money locale, without a currency symbol (table cells). */
export function formatAmount(cents: number, money: DocumentMoney): string {
  const digits = money.fractionDigits;
  const value = Number.isFinite(cents) ? cents : 0;
  return numberFormat(money.currencyLocale, digits, digits).format(value / 100);
}

/** Cents with the currency symbol (the grand total). */
export function formatTotal(cents: number, money: DocumentMoney): string {
  return formatMoney(cents, money);
}

/**
 * Cents rounded the way they are displayed (NT$ has no minor unit), so the
 * amount in words matches the figure printed next to it.
 */
export function displayedCents(cents: number, fractionDigits: number): number {
  const value = Number.isFinite(cents) ? Math.round(cents) : 0;
  if (fractionDigits >= 2) return value;
  const step = fractionDigits === 1 ? 10 : 100;
  const rounded = Math.round(Math.abs(value) / step) * step;
  return value < 0 ? -rounded : rounded;
}

/**
 * zh: 新台幣壹萬貳仟參佰元整 (formal numerals, for TWD; other currencies get
 * their code as the prefix). Other locales: "TWD One thousand … only".
 */
export function amountInWords(cents: number, money: DocumentMoney, locale: string): string {
  const value = displayedCents(cents, money.fractionDigits);
  const currency = money.currency.toUpperCase();
  if (isChineseLocale(locale)) {
    return amountInWordsZhTW(value, { prefix: currency === "TWD" ? "新台幣" : `${currency} ` });
  }
  return `${currency} ${amountInWordsEn(value)}`;
}

/** Empty / whitespace-only → null, so optional rows can be skipped. */
export function present(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed === "" ? null : trimmed;
}
