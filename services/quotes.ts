import "server-only";
import { db } from "@/db";
import { customers, quotationItems, quotations, quoteEvents } from "@/db/schema";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { isIsoDate, todayInTimeZone } from "@/lib/dates";
import { parseQuoteId } from "@/lib/schemas/quote";
import { MAX_SEARCH_QUERY_LENGTH, firstParam, normalizeSearchQuery } from "@/lib/search-query";
import {
  DISPLAY_STATUS_VALUES,
  displayStatus,
  isDisplayStatus,
  type DisplayStatus,
} from "@/lib/status";
import { getSettings } from "@/services/settings";

export const QUOTE_LIST_SORTS = [
  "newest",
  "oldest",
  "amount_desc",
  "amount_asc",
  "valid_until",
] as const;
export type QuoteListSort = (typeof QUOTE_LIST_SORTS)[number];

export const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
/** Company names are up to 200 characters (lib/schemas/quote.ts). */
const MAX_CUSTOMER_LENGTH = 200;
export const EXPORT_BATCH_SIZE = 1000;

type SearchParamValue = string | string[] | null | undefined;

/** Raw list params, e.g. straight from searchParams. */
export type QuoteListParams = {
  q?: SearchParamValue;
  /**
   * Exact customer: quotes whose bill-to company name equals this, ignoring
   * case and surrounding spaces (the customer directory's identity), unlike
   * `q`, where "Acme" also finds "Acme Holdings".
   */
  customer?: SearchParamValue;
  status?: SearchParamValue;
  sort?: SearchParamValue;
  page?: number | SearchParamValue;
  pageSize?: number | null;
  /** YYYY-MM-DD in the business timezone; defaults to settings' today */
  today?: string;
};

export type QuoteListFilters = {
  q: string;
  /** "" = any customer */
  customer: string;
  status: DisplayStatus | null;
  sort: QuoteListSort;
  page: number;
  pageSize: number;
};

type QuoteRow = typeof quotations.$inferSelect;
type CustomerRow = typeof customers.$inferSelect;

export type QuoteListItem = QuoteRow & {
  customer: CustomerRow | null;
  displayStatus: DisplayStatus;
};

export type StatusCounts = Record<DisplayStatus | "all", number>;

export type QuotesResponse = {
  data: QuoteListItem[];
  metadata: { total: number; page: number; pageSize: number; totalPages: number };
  statusCounts: StatusCounts;
};

const firstString = firstParam;

/** Tolerant parsing of user-supplied list params (unknown values → defaults). */
export function normalizeQuoteListParams(
  params: Omit<QuoteListParams, "today">
): QuoteListFilters {
  const q = normalizeSearchQuery(params.q, MAX_SEARCH_QUERY_LENGTH);
  const customer = normalizeSearchQuery(params.customer, MAX_CUSTOMER_LENGTH);
  const status = firstString(params.status);
  const sort = firstString(params.sort);
  const page = Math.trunc(
    typeof params.page === "number" ? params.page : Number(firstString(params.page) || NaN)
  );
  const pageSize = Math.trunc(Number(params.pageSize));
  return {
    q,
    customer,
    status: isDisplayStatus(status) ? status : null,
    sort: (QUOTE_LIST_SORTS as readonly string[]).includes(sort)
      ? (sort as QuoteListSort)
      : "newest",
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    pageSize:
      Number.isFinite(pageSize) && pageSize >= 1
        ? Math.min(pageSize, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE,
  };
}

/** Rows of a db.execute() result (postgres-js returns an array). */
export function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const rows = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

/** Escapes LIKE wildcards so user text matches literally. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Clamps a requested page into [1, totalPages] (an empty list has 1 page). */
export function paginate(requestedPage: number, total: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.trunc(requestedPage) || 1), totalPages);
  return { page, totalPages, offset: (page - 1) * pageSize };
}

/** `today` if it is a valid YYYY-MM-DD, else today in the business timezone. */
export async function resolveToday(today?: string | null): Promise<string> {
  if (today && isIsoDate(today)) return today;
  const settings = await getSettings();
  return todayInTimeZone(settings.region.timezone);
}

const statusSql = sql`coalesce(${quotations.status}, 'draft')`;

export function quoteStatusCondition(status: DisplayStatus, today: string): SQL {
  switch (status) {
    case "draft":
    case "sent":
      return sql`(${statusSql} = ${status} and ${quotations.validUntil} >= ${today})`;
    case "accepted":
    case "rejected":
      return sql`${statusSql} = ${status}`;
    case "expired":
      return sql`(${statusSql} in ('draft', 'sent') and ${quotations.validUntil} < ${today})`;
  }
}

export function quoteSearchCondition(q: string): SQL | undefined {
  if (!q) return undefined;
  const pattern = `%${escapeLike(q)}%`;
  return sql`(${quotations.quotationNumber} ilike ${pattern}
    or ${quotations.title} ilike ${pattern}
    or ${customers.companyName} ilike ${pattern}
    or ${customers.contactPerson} ilike ${pattern})`;
}

/** Quotes billed to exactly this company (case and outer spaces ignored). */
export function quoteCustomerCondition(customer: string): SQL | undefined {
  if (!customer) return undefined;
  return sql`lower(btrim(${customers.companyName})) = lower(btrim(${customer}))`;
}

// Every sort is (column, id) in one direction over NOT NULL columns, so it
// matches a plain btree index (scanned backwards for desc: the newest-first
// list and dashboard stop after LIMIT rows instead of sorting the table) and
// keyset pagination can resume after any row.
type SortSpec = {
  column: typeof quotations.createdAt | typeof quotations.totalAmount | typeof quotations.validUntil;
  /** SQL type to cast a cursor's text value back to */
  type: "timestamp" | "bigint" | "date";
  dir: "asc" | "desc";
};

const SORTS: Record<QuoteListSort, SortSpec> = {
  newest: { column: quotations.createdAt, type: "timestamp", dir: "desc" },
  oldest: { column: quotations.createdAt, type: "timestamp", dir: "asc" },
  amount_desc: { column: quotations.totalAmount, type: "bigint", dir: "desc" },
  amount_asc: { column: quotations.totalAmount, type: "bigint", dir: "asc" },
  valid_until: { column: quotations.validUntil, type: "date", dir: "asc" },
};

export function quoteListOrder(sort: QuoteListSort): SQL[] {
  const spec = SORTS[sort] ?? SORTS.newest;
  const by = spec.dir === "asc" ? asc : desc;
  return [by(spec.column), by(quotations.id)];
}

type JoinedRow = { quote: QuoteRow; customer: CustomerRow | null };

function toListItem({ quote, customer }: JoinedRow, today: string): QuoteListItem {
  return {
    ...quote,
    customer,
    displayStatus: displayStatus(quote.status, quote.validUntil, today),
  };
}

async function selectQuotes(
  where: SQL | undefined,
  sort: QuoteListSort,
  limit: number,
  offset: number,
  today: string
): Promise<QuoteListItem[]> {
  const rows = await db
    .select({ quote: quotations, customer: customers })
    .from(quotations)
    .leftJoin(customers, eq(quotations.customerId, customers.id))
    .where(where)
    .orderBy(...quoteListOrder(sort))
    .limit(limit)
    .offset(offset);
  return rows.map((row) => toListItem(row, today));
}

async function countByStatus(search: SQL | undefined, today: string): Promise<StatusCounts> {
  const count = (status: DisplayStatus) =>
    sql<number>`count(*) filter (where ${quoteStatusCondition(status, today)})`.mapWith(Number);
  const [row] = await db
    .select({
      all: sql<number>`count(*)`.mapWith(Number),
      draft: count("draft"),
      sent: count("sent"),
      accepted: count("accepted"),
      rejected: count("rejected"),
      expired: count("expired"),
    })
    .from(quotations)
    .leftJoin(customers, eq(quotations.customerId, customers.id))
    .where(search);
  const counts = { all: 0 } as StatusCounts;
  for (const key of ["all", ...DISPLAY_STATUS_VALUES] as const) {
    counts[key] = Number(row?.[key] ?? 0);
  }
  return counts;
}

/**
 * The quotes list (spec §1): search, display-status filter (incl. derived
 * "expired"), sort and pagination. statusCounts honour the search but not
 * the status filter, so the status chips can show their counts.
 */
export async function getQuotesList(params: QuoteListParams = {}): Promise<QuotesResponse> {
  const filters = normalizeQuoteListParams(params);
  const today = await resolveToday(params.today);
  const search = and(quoteSearchCondition(filters.q), quoteCustomerCondition(filters.customer));

  const statusCounts = await countByStatus(search, today);
  const total = filters.status ? statusCounts[filters.status] : statusCounts.all;
  const { page, totalPages, offset } = paginate(filters.page, total, filters.pageSize);

  const data =
    total === 0
      ? []
      : await selectQuotes(
          and(search, filters.status ? quoteStatusCondition(filters.status, today) : undefined),
          filters.sort,
          filters.pageSize,
          offset,
          today
        );

  return {
    data,
    metadata: { total, page, pageSize: filters.pageSize, totalPages },
    statusCounts,
  };
}

/**
 * Every quote matching the list filters (search, customer, status) in list
 * order, `batchSize` rows at a time, for the CSV export. Keyset pages (after
 * the last row's sort value and id): no cap, and each page is an index range
 * rather than an ever-growing OFFSET.
 */
export async function* quoteExportBatches(
  params: QuoteListParams = {},
  { batchSize = EXPORT_BATCH_SIZE }: { batchSize?: number } = {}
): AsyncGenerator<QuoteListItem[], void, undefined> {
  const filters = normalizeQuoteListParams(params);
  const today = await resolveToday(params.today);
  const where = and(
    quoteSearchCondition(filters.q),
    quoteCustomerCondition(filters.customer),
    filters.status ? quoteStatusCondition(filters.status, today) : undefined
  );
  const spec = SORTS[filters.sort];
  const size = Math.min(Math.max(Math.trunc(batchSize) || EXPORT_BATCH_SIZE, 1), 10_000);
  const op = sql.raw(spec.dir === "desc" ? "<" : ">");

  let cursor: { key: string; id: number } | null = null;
  for (;;) {
    // The cursor travels as text and is cast back in SQL: a JS Date would
    // drop the microseconds of created_at and skip rows.
    const after: SQL | undefined = cursor
      ? sql`(${spec.column}, ${quotations.id}) ${op} (cast(${cursor.key} as ${sql.raw(spec.type)}), ${cursor.id})`
      : undefined;
    const rows: (JoinedRow & { sortKey: string })[] = await db
      .select({ quote: quotations, customer: customers, sortKey: sql<string>`${spec.column}::text` })
      .from(quotations)
      .leftJoin(customers, eq(quotations.customerId, customers.id))
      .where(and(where, after))
      .orderBy(...quoteListOrder(filters.sort))
      .limit(size);
    if (rows.length === 0) return;
    yield rows.map((row) => toListItem(row, today));
    if (rows.length < size) return;
    const last = rows[rows.length - 1];
    cursor = { key: last.sortKey, id: last.quote.id };
  }
}

function findQuote(id: number) {
  return db.query.quotations.findFirst({
    where: eq(quotations.id, id),
    with: {
      customer: true,
      items: {
        orderBy: [asc(quotationItems.position), asc(quotationItems.id)],
      },
      events: {
        orderBy: [desc(quoteEvents.createdAt), desc(quoteEvents.id)],
        limit: 50,
      },
    },
  });
}

export type QuoteDetail = NonNullable<Awaited<ReturnType<typeof findQuote>>>;

/** A quote with customer, ordered items and its 50 newest events; null if absent or the id is invalid. */
export async function getQuoteById(id: unknown): Promise<QuoteDetail | null> {
  const quoteId = parseQuoteId(id);
  if (quoteId === null) return null;
  return (await findQuote(quoteId)) ?? null;
}
