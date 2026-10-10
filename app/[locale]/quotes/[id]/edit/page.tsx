import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pagePath, requireSession } from "@/components/app-shell/require-session";
import { quoteDraftKey, quoteDraftPrefix, quoteVersion } from "@/components/quote-form/form-model";
import { QuoteForm } from "@/components/quote-form/quote-form";
import { isAuthenticated } from "@/lib/auth/guard";
import { todayInTimeZone } from "@/lib/dates";
import { formValuesFromRecord } from "@/lib/quote-view";
import { parseQuoteId } from "@/lib/schemas/quote";
import { normalizeStatus } from "@/lib/status";
import { routing } from "@/navigation";
import { getDocumentBranding, getSettings } from "@/services/settings";
import { loadQuote } from "./load-quote";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, id } = await params;
  // Runs alongside the layout: never read the quote for a signed-out request.
  if (!(await isAuthenticated())) return {};
  const quoteId = parseQuoteId(id);
  const quote = quoteId === null ? null : await loadQuote(quoteId);
  if (!quote) return {};
  const t = await getTranslations({ locale, namespace: "QuoteForm.meta" });
  return { title: t("editTitle", { number: quote.quotationNumber }) };
}

export default async function EditQuotePage({ params }: { params: Params }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await requireSession(locale, pagePath(locale, `/quotes/${encodeURIComponent(id)}/edit`));
  setRequestLocale(locale);

  const quoteId = parseQuoteId(id);
  if (quoteId === null) notFound();

  const [quote, settings, branding] = await Promise.all([
    loadQuote(quoteId),
    getSettings(),
    getDocumentBranding("html"),
  ]);
  if (!quote) notFound();
  const draftKey = quoteDraftKey({ id: quote.id, updatedAt: quote.updatedAt });

  return (
    <QuoteForm
      // A new version (after "Reload latest" on a conflict) is a fresh form.
      key={draftKey}
      mode="edit"
      quoteId={quote.id}
      version={quoteVersion(quote.updatedAt)}
      quotationNumber={quote.quotationNumber}
      status={normalizeStatus(quote.status)}
      // Every saved field goes into the form state, so saving never drops
      // anything the form shows only conditionally (discount, fees…).
      initialValues={formValuesFromRecord(quote)}
      draftKey={draftKey}
      draftPrunePrefix={quoteDraftPrefix(quote.id)}
      today={todayInTimeZone(settings.region.timezone)}
      branding={branding}
    />
  );
}
