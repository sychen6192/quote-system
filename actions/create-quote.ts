'use server';

import { db } from '@/db';
import { quotations, quotationItems, customers } from '@/db/schema';
import { quoteFormSchema } from '@/lib/schemas/quote';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createQuote(data: unknown) {
    const result = quoteFormSchema.safeParse(data);
    if (!result.success) return { success: false, error: result.error.format() };

    const { items, taxRate, ...quoteData } = result.data;

    const subtotal = items.reduce((acc, item) => acc + (item.quantity * Math.round(item.unitPrice * 100)), 0);
    const taxRateBP = Math.round(taxRate * 100);
    const taxAmount = Math.round(subtotal * (taxRateBP / 10000));
    const totalAmount = subtotal + taxAmount;

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

            const [newQuote] = await tx.insert(quotations).values({
                quotationNumber: `Q-${Date.now()}`,
                customerId: newCustomer.id,
                salesperson: quoteData.salesperson,
                issuedDate: quoteData.issuedDate,
                validUntil: quoteData.validUntil,
                shippingDate: quoteData.shippingDate || null,
                paymentMethod: quoteData.paymentMethod,
                shippingMethod: quoteData.shippingMethod,
                notes: quoteData.notes,
                subtotal, taxRate: taxRateBP, taxAmount, totalAmount,
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
        return { success: false, error: 'Failed' };
    }

    revalidatePath('/');
    redirect('/');
}