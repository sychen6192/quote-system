import "server-only";
import { db } from "@/db";
import { customers, quotations } from "@/db/schema";
import { sql, type SQL } from "drizzle-orm";
import { toIsoDate } from "@/lib/dates";
import { normalizeSearchQuery } from "@/lib/search-query";
import { escapeLike, paginate, rowsOf } from "@/services/quotes";

// Customers are a per-quote bill-to snapshot (one row per quote). Everything
// here groups rows by lower(btrim(company_name)) and shows the newest row.

export type CustomerOption = {
  companyName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  vatNumber: string | null;
  address: string | null;
};

export type CustomerDirectoryEntry = CustomerOption & {
  /** normalised company name: the directory's identity */
  key: string;
  quoteCount: number;
  /** sum of accepted quotes' totals, cents */
  acceptedTotal: number;
  lastIssuedDate: string | null;
  /** newest quote of this customer */
  lastQuoteId: number | null;
};

export type CustomerDirectory = {
  data: CustomerDirectoryEntry[];
  metadata: { total: number; page: number; pageSize: number; totalPages: number };
};

const DIRECTORY_PAGE_SIZE = 20;
/** Company names are up to 200 characters (lib/schemas/quote.ts). */
const MAX_NAME_LENGTH = 200;

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

function toOption(row: Record<string, unknown>): CustomerOption {
  return {
    companyName: str(row.company_name) ?? "",
    contactPerson: str(row.contact_person),
    email: str(row.email),
    phone: str(row.phone),
    vatNumber: str(row.vat_number),
    address: str(row.address),
  };
}

/** `q` must already be normalised (normalizeSearchQuery). */
function likePattern(q: string): string {
  return `%${escapeLike(q)}%`;
}

// Newest snapshot per normalised company that still belongs to a quote.
function latestPerCompany(match: SQL | undefined): SQL {
  return sql`
    select distinct on (lower(btrim(c.company_name)))
      lower(btrim(c.company_name)) as key,
      c.id, c.company_name, c.contact_person, c.email, c.phone, c.vat_number, c.address
    from ${customers} c
    where btrim(c.company_name) <> ''
      and exists (select 1 from ${quotations} q where q.customer_id = c.id)
      ${match ? sql`and ${match}` : sql``}
    order by lower(btrim(c.company_name)), c.id desc`;
}

function matchCustomer(q: string): SQL | undefined {
  if (!q) return undefined;
  const pattern = likePattern(q);
  return sql`(c.company_name ilike ${pattern} or c.contact_person ilike ${pattern}
    or c.vat_number ilike ${pattern} or c.email ilike ${pattern})`;
}

/**
 * The customer directory: one entry per company (newest snapshot) with its
 * quote count, accepted total and last quote. `q` matches the newest
 * snapshot's name, contact, VAT number or email.
 */
export async function getCustomerDirectory({
  q = "",
  page = 1,
  pageSize = DIRECTORY_PAGE_SIZE,
}: { q?: string; page?: number; pageSize?: number } = {}): Promise<CustomerDirectory> {
  const size = Math.min(Math.max(Math.trunc(pageSize) || DIRECTORY_PAGE_SIZE, 1), 100);
  const latest = sql`(${latestPerCompany(undefined)}) latest`;
  const term = normalizeSearchQuery(q);
  const pattern = likePattern(term);
  const filter = term
    ? sql`where (latest.company_name ilike ${pattern}
        or latest.contact_person ilike ${pattern}
        or latest.vat_number ilike ${pattern}
        or latest.email ilike ${pattern})`
    : sql``;

  const [countRow] = rowsOf(
    await db.execute(sql`select count(*) as total from ${latest} ${filter}`)
  );
  const total = num(countRow?.total);
  const { page: current, totalPages, offset } = paginate(page, total, size);
  if (total === 0) {
    return { data: [], metadata: { total, page: current, pageSize: size, totalPages } };
  }

  const rows = rowsOf(
    await db.execute(sql`
      with stats as (
        select lower(btrim(c.company_name)) as key,
          count(*) as quote_count,
          coalesce(sum(q.total_amount) filter (where q.status = 'accepted'), 0) as accepted_total,
          max(q.issued_date) as last_issued_date,
          (array_agg(q.id order by q.issued_date desc nulls last, q.id desc))[1] as last_quote_id
        from ${customers} c
        join ${quotations} q on q.customer_id = c.id
        where btrim(c.company_name) <> ''
        group by 1
      )
      select latest.*, stats.quote_count, stats.accepted_total,
        stats.last_issued_date, stats.last_quote_id
      from ${latest}
      join stats on stats.key = latest.key
      ${filter}
      order by stats.last_issued_date desc nulls last, latest.id desc
      limit ${size} offset ${offset}`)
  );

  return {
    data: rows.map((row) => ({
      ...toOption(row),
      key: str(row.key) ?? "",
      quoteCount: num(row.quote_count),
      acceptedTotal: num(row.accepted_total),
      lastIssuedDate: toIsoDate(str(row.last_issued_date)),
      lastQuoteId: row.last_quote_id == null ? null : num(row.last_quote_id),
    })),
    metadata: { total, page: current, pageSize: size, totalPages },
  };
}

/** Company suggestions for the quote form, newest snapshot per company. */
export async function searchCustomerOptions(q: string, limit = 8): Promise<CustomerOption[]> {
  const term = normalizeSearchQuery(q);
  if (!term) return [];
  const size = Math.min(Math.max(Math.trunc(limit) || 8, 1), 50);
  const prefix = `${escapeLike(term)}%`;
  const rows = rowsOf(
    await db.execute(sql`
      select * from (${latestPerCompany(matchCustomer(term))}) latest
      order by (latest.company_name ilike ${prefix}) desc, latest.id desc
      limit ${size}`)
  );
  return rows.map(toOption);
}

/** The newest snapshot of a company (case/whitespace-insensitive), for ?customer= prefill. */
export async function getLatestCustomerByName(name: string): Promise<CustomerOption | null> {
  const trimmed = normalizeSearchQuery(name, MAX_NAME_LENGTH);
  if (!trimmed) return null;
  const rows = rowsOf(
    await db.execute(sql`
      select c.company_name, c.contact_person, c.email, c.phone, c.vat_number, c.address
      from ${customers} c
      where lower(btrim(c.company_name)) = lower(btrim(${trimmed}))
      order by c.id desc
      limit 1`)
  );
  return rows[0] ? toOption(rows[0]) : null;
}
