'use server';

import { db } from '@/db';
import { quotations, quotationItems, customers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { quoteFormSchema, type QuoteFormData } from '@/lib/schemas/quote';
import { toBasisPoints, calculateQuoteFinancials } from '@/lib/utils';
import type { ActionResult } from './types';

export async function updateQuote(id: number, rawData: QuoteFormData): Promise<ActionResult> {
    const result = quoteFormSchema.safeParse(rawData);
    if (!result.success) {
        return {
            success: false,
            code: 'VALIDATION',
            fieldErrors: result.error.flatten().fieldErrors,
        };
    }
    const data = result.data;

    const existingQuote = await db.query.quotations.findFirst({
        where: eq(quotations.id, id),
        columns: { id: true, customerId: true },
    });

    if (!existingQuote || !existingQuote.customerId) {
        return {
            success: false,
            code: 'NOT_FOUND',
            message: `Quote ${id} or its associated customer was not found`,
        };
    }

    const customerId = existingQuote.customerId;

    try {
        await db.transaction(async (tx) => {
            // Update Customer
            await tx
                .update(customers)
                .set({
                    companyName: data.companyName,
                    contactPerson: data.contactPerson,
                    email: data.email || null,
                    phone: data.phone,
                    vatNumber: data.vatNumber,
                    address: data.address,
                })
                .where(eq(customers.id, customerId));

            // Calculate Financials
            const taxRateBP = toBasisPoints(data.taxRate);
            const itemsWithCents = data.items.map(item => ({
                ...item,
                unitPrice: Math.round(item.unitPrice * 100),
                isTaxable: item.isTaxable // 關鍵
            }));

            const financials = calculateQuoteFinancials(itemsWithCents, taxRateBP);

            // Update Quote
            await tx
                .update(quotations)
                .set({
                    salesperson: data.salesperson,
                    issuedDate: data.issuedDate,
                    validUntil: data.validUntil,
                    notes: data.notes,

                    // Update Financials
                    taxRate: taxRateBP,
                    subtotal: financials.subtotal,
                    taxAmount: financials.taxAmount,
                    totalAmount: financials.totalAmount,
                })
                .where(eq(quotations.id, id));

            // Update Items
            await tx.delete(quotationItems).where(eq(quotationItems.quotationId, id));

            if (itemsWithCents.length > 0) {
                await tx.insert(quotationItems).values(
                    itemsWithCents.map((item) => ({
                        quotationId: id,
                        productName: item.productName,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        isTaxable: item.isTaxable,
                    }))
                );
            }
        });

        revalidatePath('/');
        revalidatePath(`/quotes/${id}`);

        return { success: true };

    } catch (error) {
        console.error("updateQuote transaction failed:", error);
        return {
            success: false,
            code: 'INTERNAL',
            message: error instanceof Error ? error.message : 'Failed to update quote',
        };
    }
}