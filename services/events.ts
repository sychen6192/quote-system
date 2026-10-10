import "server-only";
import type { db } from "@/db";
import { quoteEvents } from "@/db/schema";

export const QUOTE_EVENT_TYPES = [
  "created",
  "updated",
  "status_changed",
  "emailed",
  "duplicated",
] as const;

export type QuoteEventType = (typeof QUOTE_EVENT_TYPES)[number];

/** The db itself or a transaction handle from db.transaction(). */
export type DbExecutor =
  | typeof db
  | Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

/** Appends to a quote's activity log; call inside the transaction that made the change. */
export async function recordQuoteEvent(
  tx: DbExecutor,
  quoteId: number,
  type: QuoteEventType,
  data: Record<string, unknown> = {}
): Promise<void> {
  await tx.insert(quoteEvents).values({ quoteId, type, data });
}
