import { db } from "@/db";
import { customers } from "@/db/schema";
import { desc } from "drizzle-orm";

export type CustomerOption = {
  companyName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  vatNumber: string | null;
  address: string | null;
};

/**
 * Companies previously quoted, most recent first.
 * createQuote inserts a new customer row per quote, so dedupe by companyName
 * keeping the newest row (highest id).
 */
export async function getCustomerOptions(): Promise<CustomerOption[]> {
  const rows = await db
    .select({
      companyName: customers.companyName,
      contactPerson: customers.contactPerson,
      email: customers.email,
      phone: customers.phone,
      vatNumber: customers.vatNumber,
      address: customers.address,
    })
    .from(customers)
    .orderBy(desc(customers.id))
    .limit(2000);

  const seen = new Set<string>();
  const options: CustomerOption[] = [];
  for (const row of rows) {
    const key = row.companyName?.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    options.push(row);
    if (options.length >= 500) break;
  }
  return options;
}
