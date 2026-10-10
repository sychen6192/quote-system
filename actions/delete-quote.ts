"use server";

import { revalidatePath } from "next/cache";
import { and, eq, notExists } from "drizzle-orm";
import { db } from "@/db";
import { customers, quotationItems, quotations } from "@/db/schema";
import { quoteIdSchema } from "@/lib/schemas/quote";
import {
  internalError,
  notFound,
  requireAuth,
  validationError,
  type ActionResult,
} from "./types";

export async function deleteQuote(id: unknown): Promise<ActionResult> {
  const denied = await requireAuth();
  if (denied) return denied;

  const idResult = quoteIdSchema.safeParse(id);
  if (!idResult.success) return validationError({ id: ["invalidId"] });
  const quoteId = idResult.data;

  let found = false;
  try {
    found = await db.transaction(async (tx) => {
      // Items and events cascade; items are deleted explicitly because
      // push-created legacy databases may lack the cascading FK.
      await tx.delete(quotationItems).where(eq(quotationItems.quotationId, quoteId));
      const [deleted] = await tx
        .delete(quotations)
        .where(eq(quotations.id, quoteId))
        .returning({ customerId: quotations.customerId });
      if (!deleted) return false;

      const customerId = deleted.customerId;
      if (customerId !== null) {
        await tx
          .delete(customers)
          .where(
            and(
              eq(customers.id, customerId),
              notExists(
                tx
                  .select({ id: quotations.id })
                  .from(quotations)
                  .where(eq(quotations.customerId, customerId))
              )
            )
          );
      }
      return true;
    });
  } catch (error) {
    console.error("deleteQuote transaction failed:", error);
    return internalError("Failed to delete quote");
  }

  if (!found) return notFound(`Quote ${quoteId}`);
  revalidatePath("/[locale]", "layout");
  return { success: true, id: quoteId };
}
