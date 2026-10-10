// Calendar dates are plain "YYYY-MM-DD" strings in the business timezone
// (settings.region.timezone). Containers run in UTC and the app pins its
// Postgres sessions to UTC (db/index.ts), so "today" must never come from
// new Date().toISOString() directly.

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = ISO_DATE_RE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Today's calendar date in `timeZone` (falls back to UTC if invalid). */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  const zone = timeZone && isValidTimeZone(timeZone) ? timeZone : "UTC";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function toUtcMs(iso: string): number {
  const match = ISO_DATE_RE.exec(iso);
  if (!match) throw new Error(`Invalid ISO date: ${iso}`);
  const [, y, m, d] = match.map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Normalises a DB/date-ish value to "YYYY-MM-DD", or null. */
export function toIsoDate(value: string | Date | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  const head = value.slice(0, 10);
  return isIsoDate(head) ? head : null;
}

export function addDaysIso(iso: string, days: number): string {
  return new Date(toUtcMs(iso) + Math.trunc(days) * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** First day of the month of `iso`. */
export function startOfMonthIso(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Whole days from `today` to `iso` (negative when `iso` is in the past). */
export function daysUntil(iso: string, today: string): number {
  return Math.round((toUtcMs(iso) - toUtcMs(today)) / DAY_MS);
}

/**
 * Only open quotes expire: draft or sent (a missing status counts as draft)
 * whose valid-until day has fully passed. Accepted/rejected never expire.
 */
export function isExpired(
  validUntil: string | Date | null | undefined,
  status: string | null | undefined,
  today: string
): boolean {
  const s = status || "draft";
  if (s !== "draft" && s !== "sent") return false;
  const until = toIsoDate(validUntil);
  return until !== null && until < today;
}
