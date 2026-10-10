import type { Metadata } from "next";
import { Plus, SearchX, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, routing } from "@/navigation";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/app-shell/page-header";
import { pagePath, requireSession } from "@/components/app-shell/require-session";
import { EmptyState } from "@/components/app-shell/empty-state";
import { ListQueryProvider, ListResults, ListSearchInput } from "@/components/app-shell/list-query";
import { firstParam } from "@/components/app-shell/query";
import { formatIsoDate } from "@/components/app-shell/format";
import { PaginationControls } from "@/components/pagination-controls";
import {
  CustomerCards,
  CustomerTable,
  type CustomerRowView,
} from "@/components/customers/customer-directory";
import { formatMoney } from "@/lib/money";
import { getCustomerDirectory } from "@/services/customers";
import { getSettings } from "@/services/settings";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const MAX_QUERY_LENGTH = 100;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Customers" });
  return { title: t("title") };
}

export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const sp = await searchParams;
  await requireSession(locale, pagePath(locale, "/customers", sp));
  setRequestLocale(locale);
  const t = await getTranslations("Customers");

  const q = firstParam(sp.q).slice(0, MAX_QUERY_LENGTH);
  const page = Number.parseInt(firstParam(sp.page), 10);
  const [settings, directory] = await Promise.all([
    getSettings(),
    getCustomerDirectory({ q, page: Number.isFinite(page) ? page : 1 }),
  ]);
  const { data, metadata } = directory;

  const rows: CustomerRowView[] = data.map((c) => ({
    key: c.key,
    companyName: c.companyName.trim(),
    vatNumber: c.vatNumber?.trim() || null,
    contactPerson: c.contactPerson?.trim() || null,
    email: c.email?.trim() || null,
    phone: c.phone?.trim() || null,
    quoteCount: c.quoteCount,
    acceptedTotal: c.acceptedTotal > 0 ? formatMoney(c.acceptedTotal, settings.money) : null,
    lastQuoteLabel: formatIsoDate(c.lastIssuedDate, locale),
    lastQuoteId: c.lastQuoteId,
  }));
  const noCustomersAtAll = metadata.total === 0 && !q;

  return (
    <PageContainer className="space-y-5 md:space-y-6">
      <PageHeader
        title={t("title")}
        description={q ? t("results", { count: metadata.total }) : t("count", { count: metadata.total })}
        actions={
          // The empty state brings its own big "create" button.
          noCustomersAtAll ? null : (
            <Button asChild className="hidden h-9 rounded-lg shadow-card sm:inline-flex">
              <Link href="/quotes/new">
                <Plus aria-hidden="true" />
                {t("newQuote")}
              </Link>
            </Button>
          )
        }
      />

      {noCustomersAtAll ? (
        <EmptyState
          icon={Users}
          title={t("empty.title")}
          description={t("empty.description")}
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
          <ListSearchInput
            initialValue={q}
            label={t("search.label")}
            placeholder={t("search.placeholder")}
            className="max-w-xl"
          />
          <ListResults className="space-y-4">
            {rows.length === 0 ? (
              <EmptyState
                icon={SearchX}
                tone="muted"
                title={t("noResults.title")}
                description={t("noResults.description", { query: q })}
                action={
                  <Button asChild variant="outline" className="h-11 rounded-lg sm:h-9">
                    <Link href="/customers">{t("noResults.clear")}</Link>
                  </Button>
                }
              />
            ) : (
              <>
                <CustomerTable rows={rows} />
                <CustomerCards rows={rows} />
                <PaginationControls
                  currentPage={metadata.page}
                  totalPages={metadata.totalPages}
                  baseUrl="/customers"
                  query={{ q: q || null }}
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
