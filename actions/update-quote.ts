'use server';

import { db } from '@/db';
import { quotations, quotationItems, customers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { quoteFormSchema, type QuoteFormData } from '@/lib/schemas/quote'; //
import { toBasisPoints, calculateQuoteFinancials } from '@/lib/utils';

export async function updateQuote(id: number, rawData: QuoteFormData) {
    // 1. 加入資料驗證 (與 create-quote 保持一致，確保數字型別正確)
    const result = quoteFormSchema.safeParse(rawData);
    if (!result.success) {
        return { success: false, error: result.error.format() };
    }
    const data = result.data;

    try {
        await db.transaction(async (tx) => {
            // 2. 檢查並獲取關聯 Customer ID
            const existingQuote = await tx.query.quotations.findFirst({
                where: eq(quotations.id, id),
                with: { customer: true },
            });

            if (!existingQuote || !existingQuote.customerId) {
                throw new Error("Quote or associated customer not found");
            }

            // 3. 更新客戶資料
            await tx
                .update(customers)
                .set({
                    companyName: data.companyName,
                    contactPerson: data.contactPerson,
                    email: data.email || null, // 確保空字串轉為 null 或一致
                    phone: data.phone,
                    vatNumber: data.vatNumber,
                    address: data.address,
                })
                .where(eq(customers.id, existingQuote.customerId));

            // 4. 計算金額與稅率
            // Zod 驗證後 data.taxRate 確定為數字 (例如 5)
            const taxRateBP = toBasisPoints(data.taxRate);
            const itemsWithCents = data.items.map(item => ({
                ...item,
                unitPrice: Math.round(item.unitPrice * 100)
            }));
            const financials = calculateQuoteFinancials(itemsWithCents, taxRateBP);

            // 5. 更新報價單主表
            await tx
                .update(quotations)
                .set({
                    salesperson: data.salesperson,
                    issuedDate: data.issuedDate,
                    validUntil: data.validUntil,
                    notes: data.notes,

                    // shippingDate, paymentMethod 等欄位如果需要更新也應在此加入
                    taxRate: taxRateBP,
                    subtotal: financials.subtotal,
                    taxAmount: financials.taxAmount,
                    totalAmount: financials.totalAmount,
                })
                .where(eq(quotations.id, id));

            // 6. 更新項目 (全刪全建)
            await tx.delete(quotationItems).where(eq(quotationItems.quotationId, id));

            if (data.items.length > 0) {
                await tx.insert(quotationItems).values(
                    data.items.map((item) => ({
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

        // 移除 redirect，只回傳成功
        return { success: true };

    } catch (error) {
        console.error("Update failed:", error);
        return { success: false, error: "Failed to update quote" };
    }
}