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
