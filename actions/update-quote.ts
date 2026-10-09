"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, quotationItems, quotations } from "@/db/schema";
import { quoteRecordValues } from "@/lib/quote-view";
import { quoteFormSchema, quoteIdSchema, toFieldErrors } from "@/lib/schemas/quote";
import { recordQuoteEvent } from "@/services/events";
import {
  internalError,
  notFound,
  requireAuth,
  validationError,
  type ActionResult,
} from "./types";

class QuoteNotFound extends Error {}

export async function updateQuote(id: unknown, data: unknown): Promise<ActionResult> {
  const denied = await requireAuth();
  if (denied) return denied;

  const idResult = quoteIdSchema.safeParse(id);
  if (!idResult.success) return validationError({ id: ["invalidId"] });
  const quoteId = idResult.data;

  const parsed = quoteFormSchema.safeParse(data);
  if (!parsed.success) return validationError(toFieldErrors(parsed.error));
  const values = quoteRecordValues(parsed.data);

  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: quotations.id, customerId: quotations.customerId })
        .from(quotations)
        .where(eq(quotations.id, quoteId))
        .for("update");
      if (!existing) throw new QuoteNotFound();

      // The bill-to row is this quote's own snapshot. Legacy rows may lack one
      // or share it with another quote; never edit another quote's snapshot.
      let customerId = existing.customerId;
      if (customerId !== null) {
        const [shared] = await tx
          .select({ n: sql<number>`count(*)`.mapWith(Number) })
          .from(quotations)
          .where(and(eq(quotations.customerId, customerId), ne(quotations.id, quoteId)));
        if ((shared?.n ?? 0) > 0) customerId = null;
      }
      if (customerId === null) {
        const [created] = await tx
          .insert(customers)
          .values(values.customer)
          .returning({ id: customers.id });
        customerId = created.id;
      } else {
        await tx.update(customers).set(values.customer).where(eq(customers.id, customerId));
      }

      await tx
        .update(quotations)
        .set({ ...values.quote, customerId, updatedAt: new Date() })
        .where(eq(quotations.id, quoteId));

      await tx.delete(quotationItems).where(eq(quotationItems.quotationId, quoteId));
      await tx
        .insert(quotationItems)
        .values(values.items.map((item) => ({ ...item, quotationId: quoteId })));

      await recordQuoteEvent(tx, quoteId, "updated");
    });
  } catch (error) {
    if (error instanceof QuoteNotFound) return notFound(`Quote ${quoteId}`);
    console.error("updateQuote transaction failed:", error);
    return internalError("Failed to update quote");
  }

  revalidatePath("/[locale]", "layout");
  return { success: true, id: quoteId };
}
