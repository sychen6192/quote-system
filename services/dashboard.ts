import { db } from "@/db";
import { quotations, customers } from "@/db/schema";
import { sql, desc } from "drizzle-orm";

export async function getDashboardMetrics() {
    const [revenueRes, quotesRes, customersRes] = await Promise.all([
        db.select({ value: sql<number>`sum(${quotations.totalAmount})` }).from(quotations),
        db.select({ count: sql<number>`count(*)` }).from(quotations),
        db.select({ count: sql<number>`count(distinct ${customers.companyName})`.mapWith(Number) }).from(customers),
    ]);

    return {
        totalRevenue: revenueRes[0]?.value || 0,
        totalQuotes: quotesRes[0]?.count || 0,
        totalCustomers: customersRes[0]?.count || 0,
    };
}

export async function getRecentQuotes(limit = 5) {
    return await db.query.quotations.findMany({
        with: { customer: true },
        orderBy: [desc(quotations.createdAt)],
        limit: limit,
    });
}