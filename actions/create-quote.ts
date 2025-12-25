'use server';

import { db } from '@/db';
import { quotations, quotationItems, customers } from '@/db/schema';
import { quoteFormSchema, type QuoteFormData } from '@/lib/schemas/quote';
import { revalidatePath } from 'next/cache';
import { toBasisPoints, calculateQuoteFinancials } from '@/lib/utils';
import { like, desc } from 'drizzle-orm';

function calculateFinancials(items: QuoteFormData['items'], taxRate: number) {
    const subtotal = items.reduce((acc, item) => acc + (item.quantity * Math.round(item.unitPrice * 100)), 0);
    const taxRateBP = Math.round(taxRate * 100);
    const taxAmount = Math.round(subtotal * (taxRateBP / 10000));
    const totalAmount = subtotal + taxAmount;

    return { subtotal, taxRateBP, taxAmount, totalAmount };
}

async function generateQuoteNumber(tx: any) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const prefix = `QT-${year}${month}${day}`;

    const lastQuotes = await tx.select({ quotationNumber: quotations.quotationNumber })
        .from(quotations)
        .where(like(quotations.quotationNumber, `${prefix}-%`))
        .orderBy(desc(quotations.quotationNumber))
        .limit(1);

    let nextSeq = 1;
    if (lastQuotes.length > 0) {
        const lastId = lastQuotes[0].quotationNumber;
        const lastSeqStr = lastId.split('-').pop();
        if (lastSeqStr) {
            nextSeq = parseInt(lastSeqStr) + 1;
        }
    }

    return `${prefix}-${String(nextSeq).padStart(3, '0')}`;
}

export async function createQuote(data: unknown) {
    const result = quoteFormSchema.safeParse(data);
    if (!result.success) return { success: false, error: result.error.format() };

    const { items, taxRate, ...quoteData } = result.data;

    const financials = calculateFinancials(items, taxRate);

    try {
        await db.transaction(async (tx) => {
            const [newCustomer] = await tx.insert(customers).values({
                companyName: quoteData.companyName,
                contactPerson: quoteData.contactPerson,
                phone: quoteData.phone,
                email: quoteData.email || null,
                address: quoteData.address,
                vatNumber: quoteData.vatNumber,
            }).returning({ id: customers.id });

            const newQuotationNumber = await generateQuoteNumber(tx);

            const [newQuote] = await tx.insert(quotations).values({
                quotationNumber: newQuotationNumber,
                customerId: newCustomer.id,
                salesperson: quoteData.salesperson,
                issuedDate: quoteData.issuedDate,
                validUntil: quoteData.validUntil,
                shippingDate: quoteData.shippingDate || null,
                paymentMethod: quoteData.paymentMethod,
                shippingMethod: quoteData.shippingMethod,
                notes: quoteData.notes,
                subtotal: financials.subtotal,
                taxRate: financials.taxRateBP,
                taxAmount: financials.taxAmount,
                totalAmount: financials.totalAmount,
            }).returning({ id: quotations.id });

            if (items.length > 0) {
                await tx.insert(quotationItems).values(
                    items.map((item) => ({
                        quotationId: newQuote.id,
                        productName: item.productName,
                        quantity: item.quantity,
                        unitPrice: Math.round(item.unitPrice * 100),
                        isTaxable: item.isTaxable,
                    }))
                );
            }
        });
    } catch (error) {
        console.error('Transaction Failed:', error);
        return { success: false, error: 'Transaction Failed' };
    }

    revalidatePath('/');
    return { success: true };
}