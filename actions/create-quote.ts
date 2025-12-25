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

    // ✅ 1. 轉換稅率：前端 (5) -> DB Basis Points (500)
    // 這裡會解決您遇到的 "5% 變 0.05%" 問題
    const taxRateBP = toBasisPoints(taxRate);

    // ✅ 2. 轉換金額：前端 (元) -> DB Cents (分)
    const itemsWithCents = items.map(item => ({
        ...item,
        unitPrice: Math.round(item.unitPrice * 100)
    }));

    // ✅ 3. 統一計算：使用共用函式計算 Subtotal, Tax, Total
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

                // ✅ 4. 寫入計算好的正確金額
                subtotal: financials.subtotal,
                taxRate: taxRateBP,         // 存入 500
                taxAmount: financials.taxAmount,
                totalAmount: financials.totalAmount,
            }).returning({ id: quotations.id });

            if (itemsWithCents.length > 0) {
                await tx.insert(quotationItems).values(
                    itemsWithCents.map((item) => ({
                        quotationId: newQuote.id,
                        productName: item.productName,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice, // ✅ 這裡已經是分了，直接用
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