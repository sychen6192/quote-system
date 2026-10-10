import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageContainer } from "@/components/app-shell/page-header";
import { pagePath, requireSession } from "@/components/app-shell/require-session";
import { QuoteDocument } from "@/components/quote-document/quote-document";
import { documentMoney, formatDocumentDate, formatTotal } from "@/components/quote-document/format";
import { getQuoteDocumentLabels } from "@/components/quote-document/labels";
import { ActivityTimeline } from "@/components/quote-detail/activity-timeline";
import { QuoteDetailProvider, type QuoteDetailInfo } from "@/components/quote-detail/detail-context";
import { DetailHeader, ExpiredNotice } from "@/components/quote-detail/detail-header";
import { DocumentViewer } from "@/components/quote-detail/document-viewer";
import type { QuoteEventRecord } from "@/components/quote-detail/model";
import { MobileActionBar } from "@/components/quote-detail/quote-actions";
import { ActivityCard, CustomerCard, DetailsCard } from "@/components/quote-detail/side-cards";
import { isAuthenticated } from "@/lib/auth/guard";
import { pickCompanyName } from "@/lib/company-name";
import { todayInTimeZone } from "@/lib/dates";
import { minorUnitStep } from "@/lib/money";
import { localizedPdfFilename } from "@/lib/pdf/labels";
import { quoteViewFromRecord } from "@/lib/quote-view";
import { parseQuoteId } from "@/lib/schemas/quote";
import { routing } from "@/navigation";
import { getDocumentBranding, getSettings } from "@/services/settings";
import { loadQuote } from "./load-quote";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; id: string }>;

// The browser paginates the sheet itself: A4 with real page margins (the
// globals.css #printable-content rule assumes margin-less pages). The shell's
// viewport-high min-heights would otherwise add a blank trailing page, and in
// dark mode the dark canvas (color-scheme) would print around the paper.
const PRINT_CSS =
  "@media print{@page{size:A4;margin:10mm 0 12mm}#printable-content{padding:0 14mm!important}" +
  "body,#main{min-height:0!important}:root{color-scheme:light!important}html,body{background:#fff!important}}";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, id } = await params;
  // Runs alongside the layout: never read the quote for a signed-out request.
  if (!(await isAuthenticated())) return {};
  const quoteId = parseQuoteId(id);
  const quote = quoteId === null ? null : await loadQuote(quoteId);
  if (!quote) return {};
  const t = await getTranslations({ locale, namespace: "QuoteDetail.meta" });
  return { title: t("title", { number: quote.quotationNumber }) };
}

/** When this (always dynamic) page was rendered: the activity's "x minutes ago" baseline. */
function renderedAt(): number {
  return Date.now();
}

function timestampFormatter(locale: string, timeZone: string): (value: Date | null) => string | null {
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone });
  } catch {
    format = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  }
  return (value) => (value ? format.format(value) : null);
}

export default async function QuoteDetailPage({ params }: { params: Params }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await requireSession(locale, pagePath(locale, `/quotes/${encodeURIComponent(id)}`));
  setRequestLocale(locale);
  const lang = locale;

  const quoteId = parseQuoteId(id);
  if (quoteId === null) notFound();

  const [quote, settings, branding, labels, t] = await Promise.all([
    loadQuote(quoteId),
    getSettings(),
    getDocumentBranding("html"),
    getQuoteDocumentLabels(lang),
    getTranslations("QuoteDetail"),
  ]);
  if (!quote) notFound();

  const timeZone = settings.region.timezone;
  const today = todayInTimeZone(timeZone);
  // Rounded like the PDF and the saved totals (whole NT$ per line and for the tax).
  const view = quoteViewFromRecord(quote, { today, minorUnitStep: minorUnitStep(branding.fractionDigits) });
  const money = documentMoney(view, {
    currency: branding.currency,
    currencyLocale: branding.currencyLocale,
    fractionDigits: branding.fractionDigits,
  });
  const date = (iso: string | null) => formatDocumentDate(iso, lang);
  const timestamp = timestampFormatter(lang, timeZone);

  const info: QuoteDetailInfo = {
    id: quote.id,
    quotationNumber: quote.quotationNumber,
    title: view.title,
    status: view.status,
    validUntil: view.validUntil,
    today,
    customerName: view.customer.companyName,
    customerEmail: view.customer.email,
    companyName: pickCompanyName(settings.company.name, settings.company.nameLocal, lang),
    mailEnabled: settings.mail.enabled,
    authEnabled: settings.auth.enabled,
    locale: lang,
    pdfFilename: localizedPdfFilename(quote.quotationNumber, lang),
  };

  const events: QuoteEventRecord[] = quote.events.map((event) => ({
    id: event.id,
    type: event.type,
    data: event.data ?? null,
    createdAt: event.createdAt.toISOString(),
  }));
  // Quotes from before the activity log still show when they were created.
  if (!events.some((event) => event.type === "created") && quote.createdAt) {
    events.push({ id: -1, type: "created", data: null, createdAt: quote.createdAt.toISOString() });
  }

  const validUntilLabel = date(view.validUntil);

  return (
    <QuoteDetailProvider quote={info}>
      <style>{PRINT_CSS}</style>
      <PageContainer className="space-y-5 pb-28 md:space-y-6 md:pb-10 print:max-w-none print:p-0">
        <DetailHeader
          total={formatTotal(view.totals.total, money)}
          issuedDateLabel={date(view.issuedDate)}
          validUntilLabel={validUntilLabel}
        />
        <ExpiredNotice validUntilLabel={validUntilLabel} />

        <div className="grid items-start gap-5 md:gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem] print:block">
          <DocumentViewer>
            <QuoteDocument id="printable-content" view={view} branding={branding} labels={labels} locale={lang} />
          </DocumentViewer>

          <aside className="grid gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-1 print:hidden">
            <CustomerCard customer={view.customer} />
            <DetailsCard
              rows={[
                { label: t("details.salesperson"), value: view.salesperson || null },
                { label: t("details.paymentTerms"), value: view.paymentTerms },
                { label: t("details.delivery"), value: view.deliveryMethod },
                { label: t("details.deliveryDate"), value: date(view.deliveryDate) || null },
                { label: t("details.items"), value: t("itemCount", { count: view.items.length }) },
                { label: t("details.createdAt"), value: timestamp(quote.createdAt) },
                { label: t("details.updatedAt"), value: timestamp(quote.updatedAt) },
              ]}
            />
            <ActivityCard className="md:col-span-2 lg:col-span-1">
              <ActivityTimeline
                events={events}
                now={renderedAt()}
                timeZone={timeZone}
                headingId="quote-activity-title"
              />
            </ActivityCard>
          </aside>
        </div>
      </PageContainer>
      <MobileActionBar />
    </QuoteDetailProvider>
  );
}
