'use server';

import { db } from '@/db';
import { quotations, quotationItems, customers } from '@/db/schema';
import { quoteFormSchema } from '@/lib/schemas/quote';
import { revalidatePath } from 'next/cache';
import { like, desc } from 'drizzle-orm';
import { toBasisPoints, calculateQuoteFinancials } from '@/lib/utils';

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

    // 1. 統一轉換稅率
    const taxRateBP = toBasisPoints(taxRate);

    // 2. 轉換金額與保留 Taxable 資訊
    const itemsWithCents = items.map(item => ({
        ...item,
        unitPrice: Math.round(item.unitPrice * 100),
        isTaxable: item.isTaxable // 關鍵：傳遞免稅設定
    }));

    // 3. 使用統一計算邏輯
    const financials = calculateQuoteFinancials(itemsWithCents, taxRateBP);

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

                // 寫入正確金額
                subtotal: financials.subtotal,
                taxRate: taxRateBP,
                taxAmount: financials.taxAmount,
                totalAmount: financials.totalAmount,
            }).returning({ id: quotations.id });

            if (itemsWithCents.length > 0) {
                await tx.insert(quotationItems).values(
                    itemsWithCents.map((item) => ({
                        quotationId: newQuote.id,
                        productName: item.productName,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        isTaxable: item.isTaxable, // 寫入 DB
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