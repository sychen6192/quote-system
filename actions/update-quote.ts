"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, quotationItems, quotations } from "@/db/schema";
import { minorUnitStep } from "@/lib/money";
import { quoteRecordValues } from "@/lib/quote-view";
import { quoteFormSchema, quoteIdSchema, toFieldErrors } from "@/lib/schemas/quote";
import { recordQuoteEvent } from "@/services/events";
import { getSettings } from "@/services/settings";
import {
  conflict,
  internalError,
  notFound,
  requireAuth,
  validationError,
  type ActionResult,
  type QuoteVersion,
} from "./types";

class QuoteNotFound extends Error {}
class QuoteConflict extends Error {}

/**
 * The version the editor was loaded with: undefined → no check (e.g. "save
 * anyway"), null → a quote never edited since creation, else epoch ms.
 * NaN when malformed.
 */
function expectedVersion(raw: unknown): number | null | undefined {
  if (raw === undefined || raw === null) return raw;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : NaN;
  if (typeof raw === "string") return Date.parse(raw);
  return NaN;
}

/**
 * Saves an edited quote. Pass the quote's `updatedAt` as loaded by the editor
 * in `expectedUpdatedAt` (a {@link QuoteVersion}): when someone else saved it
 * (or changed its status) in between, nothing is written and the result is
 * CONFLICT, so two open editors cannot silently overwrite each other; see
 * `ConflictFailure` in ./types for what the UI offers then. Without it the check
 * is skipped ("save anyway"). Both sides come from the same drizzle mapping
 * (millisecond precision), so they compare exactly. The type is for callers:
 * a Server Action receives whatever the client sends, so it is checked again.
 */
export async function updateQuote(
  id: unknown,
  data: unknown,
  expectedUpdatedAt?: QuoteVersion
): Promise<ActionResult> {
  const denied = await requireAuth();
  if (denied) return denied;

  const idResult = quoteIdSchema.safeParse(id);
  if (!idResult.success) return validationError({ id: ["invalidId"] });
  const quoteId = idResult.data;

  const expected = expectedVersion(expectedUpdatedAt);
  if (Number.isNaN(expected)) return validationError({ expectedUpdatedAt: ["invalidValue"] });

  const parsed = quoteFormSchema.safeParse(data);
  if (!parsed.success) return validationError(toFieldErrors(parsed.error));

  let step: number;
  try {
    step = minorUnitStep((await getSettings()).money.fractionDigits);
  } catch (error) {
    console.error("updateQuote: could not load settings:", error);
    return internalError("Failed to update quote");
  }
  // Stored totals are whole displayed units (e.g. NT$), like the document.
  const values = quoteRecordValues(parsed.data, { minorUnitStep: step });

  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: quotations.id, customerId: quotations.customerId, updatedAt: quotations.updatedAt })
        .from(quotations)
        .where(eq(quotations.id, quoteId))
        .for("update");
      if (!existing) throw new QuoteNotFound();
      if (expected !== undefined && (existing.updatedAt?.getTime() ?? null) !== expected) {
        throw new QuoteConflict();
      }

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
    if (error instanceof QuoteConflict) return conflict(`Quote ${quoteId} was changed by someone else`);
    console.error("updateQuote transaction failed:", error);
    return internalError("Failed to update quote");
  }

  revalidatePath("/[locale]", "layout");
  return { success: true, id: quoteId };
}
