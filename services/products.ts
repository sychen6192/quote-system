import "server-only";
import { db } from "@/db";
import { quotationItems } from "@/db/schema";
import { sql } from "drizzle-orm";
import { normalizeSearchQuery } from "@/lib/search-query";
import { escapeLike, rowsOf } from "@/services/quotes";

export type ProductOption = {
  productName: string;
  description: string | null;
  unit: string | null;
  /** cents */
  unitPrice: number;
  isTaxable: boolean;
};

function toOption(row: Record<string, unknown>): ProductOption {
  return {
    productName: String(row.product_name ?? ""),
    description: typeof row.description === "string" ? row.description : null,
    unit: typeof row.unit === "string" ? row.unit : null,
    unitPrice: Number(row.unit_price ?? 0),
    isTaxable: row.is_taxable !== false,
  };
}

/**
 * Item suggestions from past quotes: the newest line per normalised product
 * name, names starting with `q` first.
 */
export async function searchProductOptions(q: string, limit = 8): Promise<ProductOption[]> {
  const term = normalizeSearchQuery(q);
  if (!term) return [];
  const size = Math.min(Math.max(Math.trunc(limit) || 8, 1), 50);
  const escaped = escapeLike(term);
  const rows = rowsOf(
    await db.execute(sql`
      select * from (
        select distinct on (lower(btrim(i.product_name)))
          i.id, i.product_name, i.description, i.unit, i.unit_price, i.is_taxable
        from ${quotationItems} i
        where btrim(i.product_name) <> ''
          and i.product_name ilike ${`%${escaped}%`}
        order by lower(btrim(i.product_name)), i.id desc
      ) latest
      order by (latest.product_name ilike ${`${escaped}%`}) desc, latest.id desc
      limit ${size}`)
  );
  return rows.map(toOption);
}

/**
 * The items used most recently (newest line per normalised name), for the
 * quote form's item list before anything is typed.
 */
export async function recentProductOptions(limit = 8): Promise<ProductOption[]> {
  const size = Math.min(Math.max(Math.trunc(limit) || 8, 1), 50);
  const rows = rowsOf(
    await db.execute(sql`
      select * from (
        select distinct on (lower(btrim(i.product_name)))
          i.id, i.product_name, i.description, i.unit, i.unit_price, i.is_taxable
        from ${quotationItems} i
        where btrim(i.product_name) <> ''
        order by lower(btrim(i.product_name)), i.id desc
      ) latest
      order by latest.id desc
      limit ${size}`)
  );
  return rows.map(toOption);
}
