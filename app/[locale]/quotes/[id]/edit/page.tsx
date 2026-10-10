import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { quoteDraftKey, quoteDraftPrefix } from "@/components/quote-form/form-model";
import { QuoteForm } from "@/components/quote-form/quote-form";
import { todayInTimeZone } from "@/lib/dates";
import { formValuesFromRecord } from "@/lib/quote-view";
import { parseQuoteId } from "@/lib/schemas/quote";
import { normalizeStatus } from "@/lib/status";
import { getDocumentBranding, getSettings } from "@/services/settings";
import { loadQuote } from "./load-quote";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, id } = await params;
  const quoteId = parseQuoteId(id);
  const quote = quoteId === null ? null : await loadQuote(quoteId);
  if (!quote) return {};
  const t = await getTranslations({ locale, namespace: "QuoteForm.meta" });
  return { title: t("editTitle", { number: quote.quotationNumber }) };
}

export default async function EditQuotePage({ params }: { params: Params }) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const quoteId = parseQuoteId(id);
  if (quoteId === null) notFound();

  const [quote, settings, branding] = await Promise.all([
    loadQuote(quoteId),
    getSettings(),
    getDocumentBranding("html"),
  ]);
  if (!quote) notFound();

  return (
    <QuoteForm
      mode="edit"
      quoteId={quote.id}
      quotationNumber={quote.quotationNumber}
      status={normalizeStatus(quote.status)}
      // Every saved field goes into the form state, so saving never drops
      // anything the form shows only conditionally (discount, fees…).
      initialValues={formValuesFromRecord(quote)}
      draftKey={quoteDraftKey({ id: quote.id, updatedAt: quote.updatedAt })}
      draftPrunePrefix={quoteDraftPrefix(quote.id)}
      today={todayInTimeZone(settings.region.timezone)}
      branding={branding}
    />
  );
}
