// Pure helpers behind the quote detail page (no React), unit-tested in
// tests/unit/document.
import { daysUntil, isIsoDate } from "@/lib/dates";
import { isQuoteStatus, type DisplayStatus, type QuoteStatus } from "@/lib/status";

/** Within this many days an open quote's validity is highlighted. */
export const EXPIRING_SOON_DAYS = 7;

export type Validity =
  | { kind: "expired"; days: number }
  | { kind: "soon"; days: number }
  | { kind: "open"; days: number }
  /** accepted / rejected: the date no longer matters */
  | { kind: "closed" };

export function validityOf(validUntil: string, today: string, status: DisplayStatus): Validity {
  if (status === "accepted" || status === "rejected" || !isIsoDate(validUntil) || !isIsoDate(today)) {
    return { kind: "closed" };
  }
  const days = daysUntil(validUntil, today);
  if (days < 0) return { kind: "expired", days: -days };
  if (days <= EXPIRING_SOON_DAYS) return { kind: "soon", days };
  return { kind: "open", days };
}

export type RelativeTime = { value: number; unit: Intl.RelativeTimeFormatUnit } | null;

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** The largest whole unit between `then` and `now` (negative = past); null under a minute. */
export function relativeTime(then: number, now: number): RelativeTime {
  const seconds = Math.round((then - now) / 1000);
  const abs = Math.abs(seconds);
  for (const [unit, size] of UNITS) {
    if (abs >= size) return { value: Math.trunc(seconds / size), unit };
  }
  return null;
}

export const MAX_CC = 5;

/** "a@x.tw, b@x.tw; c@x.tw" → unique, trimmed addresses (comma, semicolon or whitespace separated). */
export function splitEmailList(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[,;\s，；]+/)) {
    const email = part.trim();
    if (!email || seen.has(email.toLowerCase())) continue;
    seen.add(email.toLowerCase());
    out.push(email);
  }
  return out;
}

// Same shape as the server's check (zod's email); the server stays the authority.
const EMAIL_RE = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;

export function looksLikeEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value.trim());
}

export type QuoteEventRecord = {
  id: number;
  type: string;
  data: Record<string, unknown> | null;
  /** ISO timestamp */
  createdAt: string;
};

export type ActivityEntry =
  | { id: number; at: string; kind: "created" | "updated" | "duplicated" | "unknown" }
  | { id: number; at: string; kind: "status"; from: QuoteStatus | null; to: QuoteStatus }
  | { id: number; at: string; kind: "emailed"; to: string; cc: string[] };

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];

/** Normalises the stored events (their `data` is free-form JSON). */
export function activityEntries(events: readonly QuoteEventRecord[]): ActivityEntry[] {
  return events.map((event): ActivityEntry => {
    const data = event.data ?? {};
    const base = { id: event.id, at: event.createdAt };
    switch (event.type) {
      case "created":
      case "updated":
      case "duplicated":
        return { ...base, kind: event.type };
      case "status_changed":
        if (isQuoteStatus(data.to)) {
          return { ...base, kind: "status", from: isQuoteStatus(data.from) ? data.from : null, to: data.to };
        }
        return { ...base, kind: "updated" };
      case "emailed":
        return {
          ...base,
          kind: "emailed",
          to: typeof data.to === "string" ? data.to : "",
          cc: strings(data.cc),
        };
      default:
        return { ...base, kind: "unknown" };
    }
  });
}
