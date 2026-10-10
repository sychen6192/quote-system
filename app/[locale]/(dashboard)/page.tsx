import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CircleCheckBig, FilePen, Plus, Send, TrendingUp } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/app-shell/page-header";
import { formatIsoDate, formatPercent } from "@/components/app-shell/format";
import { KpiCard, Meter } from "@/components/dashboard/kpi-card";
import { ExpiringList } from "@/components/dashboard/expiring-list";
import { RecentQuotes } from "@/components/dashboard/recent-quotes";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { FirstRunHero } from "@/components/dashboard/first-run";
import {
  APP_INSTALLED_COOKIE,
  SETUP_DISMISSED_COOKIE,
  setupProgress,
  type SetupDone,
} from "@/components/dashboard/setup-state";
import { toQuoteRowView } from "@/components/quotes/quote-row";
import { todayInTimeZone } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getDashboardMetrics, getExpiringSoon, getRecentQuotes } from "@/services/dashboard";
import { getQuotesList } from "@/services/quotes";
import { getBrandingStatus, getSettings } from "@/services/settings";

export const dynamic = "force-dynamic";

const EXPIRING_SHOWN = 6;

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Dashboard" });
  return { title: t("title") };
}

export default async function DashboardPage({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Dashboard");

  const settings = await getSettings();
  const today = todayInTimeZone(settings.region.timezone);
  const money = settings.money;
  const [metrics, expiring, recent, branding, list, cookieStore] = await Promise.all([
    getDashboardMetrics({ today, timeZone: settings.region.timezone }),
    getExpiringSoon(today, 7, 50),
    getRecentQuotes(6, today),
    getBrandingStatus(),
    // Status counts exactly as the quotes list filters them (drafts that have
    // expired count as expired there), so a KPI and its list always agree.
    getQuotesList({ today, pageSize: 1 }),
    cookies(),
  ]);
  const counts = list.statusCounts;

  const setupDone: SetupDone = {
    company: !settings.company.isDefault,
    logo: branding.logo === "db" || branding.logo === "file",
    firstQuote: metrics.totalQuotes > 0,
    install: cookieStore.get(APP_INSTALLED_COOKIE)?.value === "1",
  };
  const showChecklist =
    cookieStore.get(SETUP_DISMISSED_COOKIE)?.value !== "1" && !setupProgress(setupDone).complete;
  const checklist = showChecklist ? <SetupChecklist done={setupDone} /> : null;
  const firstRun = metrics.totalQuotes === 0;

  const header = (
    <PageHeader
      title={t("title")}
      description={t("subtitle", { date: formatIsoDate(today, locale, "full") })}
      actions={
        firstRun ? null : (
          <Button asChild className="hidden h-9 rounded-lg shadow-card sm:inline-flex">
            <Link href="/quotes/new">
              <Plus aria-hidden="true" />
              {t("newQuote")}
            </Link>
          </Button>
        )
      }
    />
  );

  if (firstRun) {
    return (
      <PageContainer className="space-y-6">
        {header}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <FirstRunHero showCompanyLink={!setupDone.company} />
          {checklist}
        </div>
      </PageContainer>
    );
  }

  const rate = metrics.acceptanceRate90d;
  const rows = recent.map((row) => toQuoteRowView(row, { today, money, locale }));

  return (
    <PageContainer className="space-y-6">
      {header}

      <section aria-label={t("kpi.label")} className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard
          href="/quotes?status=sent"
          label={t("kpi.openPipeline")}
          value={formatMoney(metrics.openPipelineValue, money)}
          hint={t("kpi.openPipelineHint", { count: metrics.openCount })}
          icon={Send}
          tone="info"
        />
        <KpiCard
          href="/quotes?status=accepted"
          label={t("kpi.acceptedThisMonth")}
          value={formatMoney(metrics.acceptedThisMonthValue, money)}
          hint={t("kpi.acceptedThisMonthHint", { count: metrics.acceptedThisMonthCount })}
          icon={CircleCheckBig}
          tone="success"
        />
        <KpiCard
          href="/quotes?status=accepted"
          label={t("kpi.acceptanceRate")}
          value={rate === null ? "—" : formatPercent(rate, locale)}
          hint={rate === null ? t("kpi.acceptanceRateEmpty") : t("kpi.acceptanceRateHint")}
          icon={TrendingUp}
          tone="primary"
          footer={rate === null ? null : <Meter value={rate} />}
        />
        <KpiCard
          href="/quotes?status=draft"
          label={t("kpi.drafts")}
          value={counts.draft}
          hint={
            counts.expired > 0 ? (
              <span className="font-medium text-warning">
                {t("kpi.expiredHint", { count: counts.expired })}
              </span>
            ) : (
              t("kpi.draftsHint", { count: counts.draft })
            )
          }
          icon={FilePen}
          tone="muted"
        />
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        {/* DOM order = phone order (to-dos first), so focus order matches what
            is shown; on lg+ recent quotes move to the left column. */}
        <div className="space-y-6 lg:col-start-2 lg:row-start-1">
          {checklist}
          <ExpiringList
            total={expiring.length}
            items={expiring.slice(0, EXPIRING_SHOWN).map((q) => ({
              id: q.id,
              number: q.quotationNumber,
              customerName: q.customer?.companyName?.trim() || null,
              total: formatMoney(q.totalAmount, money),
              daysLeft: q.daysLeft,
            }))}
          />
        </div>
        <RecentQuotes rows={rows} className="lg:col-start-1 lg:row-start-1" />
      </div>
    </PageContainer>
  );
}
