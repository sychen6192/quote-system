"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { quotations } from "@/db/schema";
import { quoteIdSchema } from "@/lib/schemas/quote";
import { canTransition, isQuoteStatus, normalizeStatus, type QuoteStatus } from "@/lib/status";
import { recordQuoteEvent } from "@/services/events";
import {
  internalError,
  notFound,
  requireAuth,
  validationError,
  type ActionResult,
} from "./types";

class QuoteNotFound extends Error {}

/**
 * Manual status change. → sent stamps sentAt; → accepted/rejected stamps
 * decidedAt; back to draft/sent clears decidedAt. Setting the current status
 * again is a successful no-op (double clicks, stale tabs).
 */
export async function setQuoteStatus(id: unknown, status: unknown): Promise<ActionResult> {
  const denied = await requireAuth();
  if (denied) return denied;

  const idResult = quoteIdSchema.safeParse(id);
  const fieldErrors: Record<string, string[]> = {};
  if (!idResult.success) fieldErrors.id = ["invalidId"];
  if (!isQuoteStatus(status)) fieldErrors.status = ["invalidStatus"];
  if (!idResult.success || !isQuoteStatus(status)) return validationError(fieldErrors);
  const quoteId = idResult.data;
  const to: QuoteStatus = status;

  let changed = false;
  try {
    changed = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ status: quotations.status })
        .from(quotations)
        .where(eq(quotations.id, quoteId))
        .for("update");
      if (!existing) throw new QuoteNotFound();

      const from = normalizeStatus(existing.status);
      if (!canTransition(from, to)) return false;

      const now = new Date();
      await tx
        .update(quotations)
        .set({
          status: to,
          updatedAt: now,
          ...(to === "sent" ? { sentAt: now } : {}),
          decidedAt: to === "accepted" || to === "rejected" ? now : null,
        })
        .where(eq(quotations.id, quoteId));
      await recordQuoteEvent(tx, quoteId, "status_changed", { from, to });
      return true;
    });
  } catch (error) {
    if (error instanceof QuoteNotFound) return notFound(`Quote ${quoteId}`);
    console.error("setQuoteStatus failed:", error);
    return internalError("Failed to change quote status");
  }

  if (changed) revalidatePath("/[locale]", "layout");
  return { success: true, id: quoteId };
}
