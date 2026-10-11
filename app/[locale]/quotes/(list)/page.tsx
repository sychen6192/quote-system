import type { Metadata } from "next";
import { Download, FileText, Plus, SearchX } from "lucide-react";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, routing } from "@/navigation";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/app-shell/page-header";
import { pagePath, requireSession } from "@/components/app-shell/require-session";
import { EmptyState } from "@/components/app-shell/empty-state";
import { DownloadLink } from "@/components/app-shell/download-link";
import { ListQueryProvider, ListResults } from "@/components/app-shell/list-query";
import { firstParam, mergeQuery } from "@/components/app-shell/query";
import { PaginationControls } from "@/components/pagination-controls";
import { QuotesToolbar } from "@/components/quotes/quotes-toolbar";
import { QuotesTable } from "@/components/quotes/quotes-table";
import { QuoteCards } from "@/components/quotes/quote-cards";
import { toQuoteRowView } from "@/components/quotes/quote-row";
import { todayInTimeZone } from "@/lib/dates";
import { getQuotesList, normalizeQuoteListParams } from "@/services/quotes";
import { getSettings } from "@/services/settings";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "QuotesList" });
  return { title: t("title") };
}

export default async function QuotesListPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const sp = await searchParams;
  await requireSession(locale, pagePath(locale, "/quotes", sp));
  setRequestLocale(locale);
  const t = await getTranslations("QuotesList");

  const settings = await getSettings();
  const today = todayInTimeZone(settings.region.timezone);
  const raw = {
    q: firstParam(sp.q),
    customer: firstParam(sp.customer),
    status: firstParam(sp.status),
    sort: firstParam(sp.sort),
    page: firstParam(sp.page),
  };
  const filters = normalizeQuoteListParams(raw);
  const { data, metadata, statusCounts } = await getQuotesList({ ...raw, today });

  const rows = data.map((row) => toQuoteRowView(row, { today, money: settings.money, locale }));
  // Only filters that took effect; unknown values were ignored by the service.
  const query = {
    q: filters.q || null,
    customer: filters.customer || null,
    status: filters.status,
    sort: filters.sort === "newest" ? null : filters.sort,
  };
  const exportHref = `/api/export/quotes?${mergeQuery(query, { lang: locale }).toString()}`;
  const filtered = Boolean(filters.q || filters.customer || filters.status);
  const noQuotesAtAll = statusCounts.all === 0 && !filters.q && !filters.customer;

  return (
    <PageContainer className="space-y-5 md:space-y-6">
      <PageHeader
        title={t("title")}
        description={
          filtered ? t("results", { count: metadata.total }) : t("count", { count: metadata.total })
        }
        actions={
          <>
            {noQuotesAtAll ? null : (
              <Button
                asChild
                variant="outline"
                className="h-10 rounded-lg bg-card shadow-card sm:h-9"
              >
                <DownloadLink href={exportHref} title={t("exportCsvHint")}>
                  <Download aria-hidden="true" />
                  {t("exportCsv")}
                </DownloadLink>
              </Button>
            )}
            {/* The empty state brings its own big "create" button. */}
            {noQuotesAtAll ? null : (
              <Button asChild className="hidden h-9 rounded-lg shadow-card sm:inline-flex">
                <Link href="/quotes/new">
                  <Plus aria-hidden="true" />
                  {t("newQuote")}
                </Link>
              </Button>
            )}
          </>
        }
      />

      {noQuotesAtAll ? (
        <EmptyState
          icon={FileText}
          title={t("empty.title")}
          action={
            <Button asChild size="lg" className="h-11 rounded-lg">
              <Link href="/quotes/new">
                <Plus aria-hidden="true" />
                {t("empty.cta")}
              </Link>
            </Button>
          }
        />
      ) : (
        <ListQueryProvider>
          <QuotesToolbar
            q={filters.q}
            customer={filters.customer}
            status={filters.status}
            sort={filters.sort}
            counts={statusCounts}
          />
          <ListResults className="space-y-4">
            {rows.length === 0 ? (
              <EmptyState
                icon={SearchX}
                tone="muted"
                title={t("noResults.title")}
                description={
                  filters.q
                    ? t("noResults.withQuery", { query: filters.q })
                    : filters.customer
                      ? t("noResults.withCustomer", { name: filters.customer })
                      : t("noResults.description")
                }
                action={
                  filtered ? (
                    <Button asChild variant="outline" className="h-11 rounded-lg sm:h-9">
                      <Link href={filters.sort === "newest" ? "/quotes" : `/quotes?sort=${filters.sort}`}>
                        {t("noResults.clear")}
                      </Link>
                    </Button>
                  ) : null
                }
              />
            ) : (
              <>
                <QuotesTable rows={rows} />
                <QuoteCards rows={rows} />
                <PaginationControls
                  currentPage={metadata.page}
                  totalPages={metadata.totalPages}
                  baseUrl="/quotes"
                  query={query}
                  total={metadata.total}
                  pageSize={metadata.pageSize}
                />
              </>
            )}
          </ListResults>
        </ListQueryProvider>
      )}
    </PageContainer>
  );
}
