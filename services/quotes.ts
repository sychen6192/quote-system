import { db } from "@/db";
import { quotations } from "@/db/schema";
import { desc, sql } from "drizzle-orm";

export type QuotesResponse = {
    data: Awaited<ReturnType<typeof getQuotesListQuery>>;
    metadata: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    };
};

const getQuotesListQuery = (limit: number, offset: number) => {
    return db.query.quotations.findMany({
        with: { customer: true },
        orderBy: [desc(quotations.createdAt)],
        limit: limit,
        offset: offset,
    });
};

export async function getQuotesList(page: number = 1, pageSize: number = 10) {
    const offset = (page - 1) * pageSize;

    const [data, countResult] = await Promise.all([
        getQuotesListQuery(pageSize, offset),
        db.select({ count: sql<number>`count(*)` }).from(quotations),
    ]);

    const total = Number(countResult[0]?.count || 0);

    return {
        data,
        metadata: {
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        },
    };
}

export type QuoteListItem = Awaited<ReturnType<typeof getQuotesListQuery>>[number];