import "server-only";
import { db } from "@/db";
import { customers, quotationItems, quotations, quoteEvents } from "@/db/schema";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { isIsoDate, todayInTimeZone } from "@/lib/dates";
import { parseQuoteId } from "@/lib/schemas/quote";
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
const MAX_QUERY_LENGTH = 100;
const MAX_EXPORT_ROWS = 10_000;

type SearchParamValue = string | string[] | null | undefined;

/** Raw list params, e.g. straight from searchParams. */
export type QuoteListParams = {
  q?: SearchParamValue;
  status?: SearchParamValue;
  sort?: SearchParamValue;
  page?: number | SearchParamValue;
  pageSize?: number | null;
  /** YYYY-MM-DD in the business timezone; defaults to settings' today */
  today?: string;
};

export type QuoteListFilters = {
  q: string;
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

function firstString(value: unknown): string {
  if (Array.isArray(value)) return firstString(value[0]);
  return typeof value === "string" ? value : "";
}

/** Tolerant parsing of user-supplied list params (unknown values → defaults). */
export function normalizeQuoteListParams(
  params: Omit<QuoteListParams, "today">
): QuoteListFilters {
  const q = firstString(params.q).trim().slice(0, MAX_QUERY_LENGTH);
  const status = firstString(params.status);
  const sort = firstString(params.sort);
  const page = Math.trunc(
    typeof params.page === "number" ? params.page : Number(firstString(params.page) || NaN)
  );
  const pageSize = Math.trunc(Number(params.pageSize));
  return {
    q,
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

function orderFor(sort: QuoteListSort): SQL[] {
  switch (sort) {
    case "oldest":
      return [sql`${quotations.createdAt} asc nulls first`, asc(quotations.id)];
    case "amount_desc":
      return [desc(quotations.totalAmount), desc(quotations.id)];
    case "amount_asc":
      return [asc(quotations.totalAmount), asc(quotations.id)];
    case "valid_until":
      return [asc(quotations.validUntil), asc(quotations.id)];
    case "newest":
    default:
      return [sql`${quotations.createdAt} desc nulls last`, desc(quotations.id)];
  }
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
    .orderBy(...orderFor(sort))
    .limit(limit)
    .offset(offset);
  return rows.map(({ quote, customer }) => ({
    ...quote,
    customer,
    displayStatus: displayStatus(quote.status, quote.validUntil, today),
  }));
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
  const search = quoteSearchCondition(filters.q);

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

/** Every quote matching the list filters (no paging), for CSV export. */
export async function listQuotesForExport(
  params: QuoteListParams = {}
): Promise<QuoteListItem[]> {
  const filters = normalizeQuoteListParams(params);
  const today = await resolveToday(params.today);
  return selectQuotes(
    and(
      quoteSearchCondition(filters.q),
      filters.status ? quoteStatusCondition(filters.status, today) : undefined
    ),
    filters.sort,
    MAX_EXPORT_ROWS,
    0,
    today
  );
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
