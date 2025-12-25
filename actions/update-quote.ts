'use server';

import { db } from '@/db';
import { quotations, quotationItems, customers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { QuoteFormData } from '@/lib/schemas/quote';

export async function updateQuote(id: number, data: QuoteFormData) {
    try {
        await db.transaction(async (tx) => {
            // 1. 檢查並獲取關聯 Customer ID
            const existingQuote = await tx.query.quotations.findFirst({
                where: eq(quotations.id, id),
                with: { customer: true },
            });

            if (!existingQuote || !existingQuote.customerId) {
                throw new Error("Quote or associated customer not found");
            }

            // 2. 更新客戶資料
            await tx
                .update(customers)
                .set({
                    companyName: data.companyName,
                    contactPerson: data.contactPerson,
                    email: data.email,
                    phone: data.phone,
                    vatNumber: data.vatNumber,
                    address: data.address,
                })
                .where(eq(customers.id, existingQuote.customerId));

            // 3. 計算金額與稅率 (修正邏輯)
            // 稅率：前端傳來 5 (%) -> 轉成 500 (basis points) 存入 DB
            const taxRateForDB = Math.round(data.taxRate * 100);

            // 小計：將元轉成分 (避免浮點數誤差)
            const subtotalCents = data.items.reduce((acc, item) => {
                const priceCents = Math.round(item.unitPrice * 100);
                return acc + (item.quantity * priceCents);
            }, 0);

            // 稅額計算：(小計 * 稅率) / 10000
            const taxAmountCents = Math.round((subtotalCents * taxRateForDB) / 10000);

            // 總金額 (分)
            const totalAmountCents = subtotalCents + taxAmountCents;

            // 4. 更新報價單主表
            await tx
                .update(quotations)
                .set({
                    salesperson: data.salesperson,

                    issuedDate: data.issuedDate,
                    validUntil: data.validUntil,
                    taxRate: taxRateForDB,

                    totalAmount: totalAmountCents,
                })
                .where(eq(quotations.id, id));

            // 5. 更新項目 (全刪全建)
            await tx.delete(quotationItems).where(eq(quotationItems.quotationId, id));

            if (data.items.length > 0) {
                await tx.insert(quotationItems).values(
                    data.items.map((item) => ({
                        quotationId: id,
                        productName: item.productName,
                        quantity: item.quantity,
                        unitPrice: Math.round(item.unitPrice * 100), // 元 -> 分
                        isTaxable: item.isTaxable ?? true,
                    }))
                );
            }
        });

        revalidatePath('/');
        revalidatePath(`/quotes/${id}`);

    } catch (error) {
        console.error("Update failed:", error);
        return { error: "Failed to update quote" };
    }

    redirect(`/quotes/${id}`);
}