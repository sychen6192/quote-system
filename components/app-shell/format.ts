// Locale-aware display helpers that work in server and client components.
// Calendar dates are "YYYY-MM-DD" business-timezone strings (lib/dates.ts);
// they are formatted in UTC so no browser/server offset can shift the day.

import { isIsoDate } from "@/lib/dates";

const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" });
    cache.set(key, f);
  }
  return f;
}

export type DateStyle = "default" | "full";

/**
 * "Oct 9, 2026" / "2026/10/09" (Taiwanese documents use the numeric form);
 * `full` adds the weekday. Returns "" for anything that is not a valid date.
 */
export function formatIsoDate(
  iso: string | null | undefined,
  locale: string,
  style: DateStyle = "default"
): string {
  const day = iso?.slice(0, 10);
  if (!day || !isIsoDate(day)) return "";
  const date = new Date(`${day}T00:00:00Z`);
  const zh = locale.toLowerCase().startsWith("zh");
  if (style === "full") return formatter(locale, { dateStyle: "full" }).format(date);
  return formatter(
    locale,
    zh ? { year: "numeric", month: "2-digit", day: "2-digit" } : { dateStyle: "medium" }
  ).format(date);
}

/** 0.6667 → "67%" */
export function formatPercent(ratio: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(ratio);
}

/** First letter (or CJK character) of a name, for avatar chips. */
export function initialOf(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  const [first] = Array.from(trimmed);
  return first.toLocaleUpperCase();
}

/**
 * Rough rendered width of a figure in em (Inter semibold, tabular digits):
 * separators are narrow, everything else about a digit wide. Lets a KPI
 * shrink a huge amount to fit instead of cutting digits off.
 */
export function figureWidthEm(text: string): number {
  let em = 0;
  for (const ch of text) em += /[\s,.'’·]/.test(ch) ? 0.3 : 0.62;
  return Math.max(em, 1);
}
