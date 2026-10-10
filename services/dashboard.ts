import "server-only";
import { db } from "@/db";
import { customers, quotations } from "@/db/schema";
import { and, asc, desc, gte, lte, sql } from "drizzle-orm";
import { addDaysIso, daysUntil, isIsoDate, isValidTimeZone, startOfMonthIso } from "@/lib/dates";
import { displayStatus, type DisplayStatus } from "@/lib/status";
import { getSettings } from "@/services/settings";
import { resolveToday } from "@/services/quotes";

export type DashboardMetrics = {
  /** sent and not expired (cents) */
  openPipelineValue: number;
  openCount: number;
  /** accepted, decided (or, for legacy rows, issued) this month (cents) */
  acceptedThisMonthValue: number;
  acceptedThisMonthCount: number;
  /** every accepted quote ever (cents) */
  acceptedTotalValue: number;
  /** accepted / (accepted + rejected) decided in the last 90 days, 0–1; null when none */
  acceptanceRate90d: number | null;
  draftCount: number;
  expiredCount: number;
  totalQuotes: number;
  /** distinct normalised company names that have at least one quote */
  totalCustomers: number;
};

export type DashboardMetricsOptions = {
  /** YYYY-MM-DD in the business timezone */
  today?: string;
  /** YYYY-MM-01; defaults to the month of `today` */
  monthStart?: string;
  /** IANA zone for converting decided_at; defaults to settings */
  timeZone?: string;
};

/** All KPIs in one query (FILTER aggregates). */
export async function getDashboardMetrics(
  options: DashboardMetricsOptions = {}
): Promise<DashboardMetrics> {
  const today = await resolveToday(options.today);
  const monthStart = isIsoDate(options.monthStart) ? options.monthStart : startOfMonthIso(today);
  const zone =
    options.timeZone ?? (await getSettings()).region.timezone;
  const timeZone = isValidTimeZone(zone) ? zone : "UTC";
  const since90 = addDaysIso(today, -90);

  const status = sql`coalesce(${quotations.status}, 'draft')`;
  // decided_at is UTC wall time (timestamp without time zone); legacy
  // accepted/rejected rows have none, so fall back to the issue date.
  const decidedOn = sql`coalesce((${quotations.decidedAt} at time zone 'UTC' at time zone ${timeZone})::date, ${quotations.issuedDate})`;
  const open = sql`${status} = 'sent' and ${quotations.validUntil} >= ${today}`;
  const acceptedThisMonth = sql`${status} = 'accepted' and ${decidedOn} >= ${monthStart} and ${decidedOn} <= ${today}`;
  const decided90 = sql`${status} in ('accepted', 'rejected') and ${decidedOn} >= ${since90} and ${decidedOn} <= ${today}`;

  const [row] = await db
    .select({
      openPipelineValue: sql<number>`coalesce(sum(${quotations.totalAmount}) filter (where ${open}), 0)`.mapWith(Number),
      openCount: sql<number>`count(*) filter (where ${open})`.mapWith(Number),
      acceptedThisMonthValue: sql<number>`coalesce(sum(${quotations.totalAmount}) filter (where ${acceptedThisMonth}), 0)`.mapWith(Number),
      acceptedThisMonthCount: sql<number>`count(*) filter (where ${acceptedThisMonth})`.mapWith(Number),
      acceptedTotalValue: sql<number>`coalesce(sum(${quotations.totalAmount}) filter (where ${status} = 'accepted'), 0)`.mapWith(Number),
      accepted90: sql<number>`count(*) filter (where ${decided90} and ${status} = 'accepted')`.mapWith(Number),
      decided90: sql<number>`count(*) filter (where ${decided90})`.mapWith(Number),
      draftCount: sql<number>`count(*) filter (where ${status} = 'draft')`.mapWith(Number),
      expiredCount: sql<number>`count(*) filter (where ${status} in ('draft', 'sent') and ${quotations.validUntil} < ${today})`.mapWith(Number),
      totalQuotes: sql<number>`count(*)`.mapWith(Number),
      totalCustomers: sql<number>`(
        select count(distinct lower(btrim(c.company_name)))
        from ${customers} c
        where btrim(c.company_name) <> ''
          and exists (select 1 from ${quotations} q where q.customer_id = c.id)
      )`.mapWith(Number),
    })
    .from(quotations);

  const n = (value: number | undefined) => Number(value ?? 0);
  return {
    openPipelineValue: n(row?.openPipelineValue),
    openCount: n(row?.openCount),
    acceptedThisMonthValue: n(row?.acceptedThisMonthValue),
    acceptedThisMonthCount: n(row?.acceptedThisMonthCount),
    acceptedTotalValue: n(row?.acceptedTotalValue),
    acceptanceRate90d: n(row?.decided90) > 0 ? n(row?.accepted90) / n(row?.decided90) : null,
    draftCount: n(row?.draftCount),
    expiredCount: n(row?.expiredCount),
    totalQuotes: n(row?.totalQuotes),
    totalCustomers: n(row?.totalCustomers),
  };
}

function withDisplayStatus<T extends { status: string | null; validUntil: string }>(
  rows: T[],
  today: string
): (T & { displayStatus: DisplayStatus })[] {
  return rows.map((row) => ({
    ...row,
    displayStatus: displayStatus(row.status, row.validUntil, today),
  }));
}

function clampLimit(limit: number, fallback: number): number {
  const n = Math.trunc(limit);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 50) : fallback;
}

export async function getRecentQuotes(limit = 5, today?: string) {
  const day = await resolveToday(today);
  const rows = await db.query.quotations.findMany({
    with: { customer: true },
    orderBy: [sql`${quotations.createdAt} desc nulls last`, desc(quotations.id)],
    limit: clampLimit(limit, 5),
  });
  return withDisplayStatus(rows, day);
}

/** Open (draft/sent) quotes whose validity ends within `days` days, soonest first. */
export async function getExpiringSoon(today?: string, days = 7, limit = 10) {
  const day = await resolveToday(today);
  const until = addDaysIso(day, Math.max(0, Math.trunc(days) || 0));
  const rows = await db.query.quotations.findMany({
    where: and(
      sql`coalesce(${quotations.status}, 'draft') in ('draft', 'sent')`,
      gte(quotations.validUntil, day),
      lte(quotations.validUntil, until)
    ),
    with: { customer: true },
    orderBy: [asc(quotations.validUntil), asc(quotations.id)],
    limit: clampLimit(limit, 10),
  });
  return withDisplayStatus(rows, day).map((row) => ({
    ...row,
    daysLeft: daysUntil(row.validUntil, day),
  }));
}

export type RecentQuote = Awaited<ReturnType<typeof getRecentQuotes>>[number];
export type ExpiringQuote = Awaited<ReturnType<typeof getExpiringSoon>>[number];
