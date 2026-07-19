'use server';

import { db } from '@/db';
import { quotations, quotationItems } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from './types';

export async function deleteQuote(id: number): Promise<ActionResult> {
    const existing = await db.query.quotations.findFirst({
        where: eq(quotations.id, id),
        columns: { id: true },
    });

    if (!existing) {
        return {
            success: false,
            code: 'NOT_FOUND',
            message: `Quote ${id} was not found`,
        };
    }

    try {
        await db.transaction(async (tx) => {
            // Items are FK-cascaded, but delete explicitly for clarity + test coverage.
            await tx.delete(quotationItems).where(eq(quotationItems.quotationId, id));
            await tx.delete(quotations).where(eq(quotations.id, id));
        });

        revalidatePath('/');
        revalidatePath('/quotes');

        return { success: true };
    } catch (error) {
        console.error('deleteQuote transaction failed:', error);
        return {
            success: false,
            code: 'INTERNAL',
            message: error instanceof Error ? error.message : 'Failed to delete quote',
        };
    }
}
