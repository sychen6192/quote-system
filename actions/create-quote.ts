"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { customers, quotationItems, quotations } from "@/db/schema";
import {
  DEFAULT_QUOTE_NUMBER_PATTERN,
  allocateQuoteNumber,
  validateQuoteNumberPattern,
} from "@/lib/quote-number";
import { quoteRecordValues } from "@/lib/quote-view";
import { quoteFormSchema, toFieldErrors } from "@/lib/schemas/quote";
import { recordQuoteEvent } from "@/services/events";
import { getSettings } from "@/services/settings";
import {
  internalError,
  pgConstraintName,
  pgErrorCode,
  requireAuth,
  validationError,
  type ActionResult,
} from "./types";

const MAX_ATTEMPTS = 3;

/** Another transaction took the same number between our check and insert. */
function isNumberCollision(error: unknown): boolean {
  if (pgErrorCode(error) !== "23505") return false;
  const constraint = pgConstraintName(error);
  return !constraint || constraint.includes("quotation_number");
}

export async function createQuote(data: unknown): Promise<ActionResult> {
  const denied = await requireAuth();
  if (denied) return denied;

  const parsed = quoteFormSchema.safeParse(data);
  if (!parsed.success) return validationError(toFieldErrors(parsed.error));

  const values = quoteRecordValues(parsed.data);

  let pattern = DEFAULT_QUOTE_NUMBER_PATTERN;
  try {
    const configured = (await getSettings()).quote.numberPattern;
    if (validateQuoteNumberPattern(configured).ok) pattern = configured;
    else console.warn(`createQuote: invalid number pattern "${configured}", using default`);
  } catch (error) {
    console.error("createQuote: could not load settings:", error);
    return internalError("Failed to create quote");
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const id = await db.transaction(async (tx) => {
        const [customer] = await tx
          .insert(customers)
          .values(values.customer)
          .returning({ id: customers.id });

        const quotationNumber = await allocateQuoteNumber(tx, {
          pattern,
          issuedDate: values.quote.issuedDate,
        });

        const [quote] = await tx
          .insert(quotations)
          .values({
            ...values.quote,
            quotationNumber,
            customerId: customer.id,
            status: "draft",
          })
          .returning({ id: quotations.id });

        await tx
          .insert(quotationItems)
          .values(values.items.map((item) => ({ ...item, quotationId: quote.id })));

        await recordQuoteEvent(tx, quote.id, "created", { quotationNumber });
        return quote.id;
      });

      revalidatePath("/[locale]", "layout");
      return { success: true, id };
    } catch (error) {
      if (isNumberCollision(error) && attempt < MAX_ATTEMPTS) continue;
      console.error("createQuote transaction failed:", error);
      return internalError("Failed to create quote");
    }
  }
  return internalError("Failed to create quote");
}
