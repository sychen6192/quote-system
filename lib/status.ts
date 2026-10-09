import { isExpired } from "./dates";

// Mirrors QUOTE_STATUSES in db/schema.ts; kept separate so client
// components don't import the Drizzle schema.
export const QUOTE_STATUS_VALUES = ["draft", "sent", "accepted", "rejected"] as const;

export type QuoteStatus = (typeof QUOTE_STATUS_VALUES)[number];
/** What the UI shows: open quotes past their valid-until day read "expired". */
export type DisplayStatus = QuoteStatus | "expired";

export const DISPLAY_STATUS_VALUES = [
  ...QUOTE_STATUS_VALUES,
  "expired",
] as const satisfies readonly DisplayStatus[];

export function isQuoteStatus(value: unknown): value is QuoteStatus {
  return (
    typeof value === "string" &&
    (QUOTE_STATUS_VALUES as readonly string[]).includes(value)
  );
}

export function isDisplayStatus(value: unknown): value is DisplayStatus {
  return value === "expired" || isQuoteStatus(value);
}

/** Unknown / missing statuses are treated as draft (the DB default). */
export function normalizeStatus(status: string | null | undefined): QuoteStatus {
  return isQuoteStatus(status) ? status : "draft";
}

export function displayStatus(
  status: string | null | undefined,
  validUntil: string | Date | null | undefined,
  today: string
): DisplayStatus {
  const s = normalizeStatus(status);
  return isExpired(validUntil, s, today) ? "expired" : s;
}

/**
 * Manual status changes: any status may move to any other (people mis-click,
 * customers change their minds); moving to the same status is a no-op.
 */
export const STATUS_TRANSITIONS: Readonly<Record<QuoteStatus, readonly QuoteStatus[]>> = {
  draft: ["sent", "accepted", "rejected"],
  sent: ["draft", "accepted", "rejected"],
  accepted: ["draft", "sent", "rejected"],
  rejected: ["draft", "sent", "accepted"],
};

export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

const LIGHT: Record<QuoteStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const DARK: Record<QuoteStatus, string> = {
  draft: "dark:bg-slate-400/20 dark:text-slate-200",
  sent: "dark:bg-blue-400/20 dark:text-blue-200",
  accepted: "dark:bg-green-400/20 dark:text-green-200",
  rejected: "dark:bg-red-400/20 dark:text-red-200",
};

const EXPIRED_LIGHT = "bg-amber-100 text-amber-700";
const EXPIRED_DARK = "dark:bg-amber-400/20 dark:text-amber-200";

/**
 * Tailwind pill classes for a quote status.
 * @param forceLight omit dark: variants — use inside always-light surfaces
 *   (e.g. the printable invoice document, which stays white in dark mode).
 */
export function statusStyle(status: string, forceLight = false): string {
  if (status === "expired") return expiredStyle(forceLight);
  const s = normalizeStatus(status);
  return forceLight ? LIGHT[s] : `${LIGHT[s]} ${DARK[s]}`;
}

export function expiredStyle(forceLight = false): string {
  return forceLight ? EXPIRED_LIGHT : `${EXPIRED_LIGHT} ${EXPIRED_DARK}`;
}
