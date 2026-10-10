import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { quoteDraftKey } from "@/components/quote-form/form-model";
import {
  duplicateQuoteValues,
  newQuoteValues,
  withCustomer,
} from "@/components/quote-form/initial-values";
import { QuoteForm } from "@/components/quote-form/quote-form";
import { todayInTimeZone } from "@/lib/dates";
import { formValuesFromRecord } from "@/lib/quote-view";
import { parseQuoteId } from "@/lib/schemas/quote";
import { getLatestCustomerByName } from "@/services/customers";
import { getQuoteById } from "@/services/quotes";
import { getDocumentBranding, getSettings } from "@/services/settings";

// Defaults depend on the request: "today" in the business timezone and the
// Settings page values (never frozen at build time).
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "QuoteForm.meta" });
  return { title: t("newTitle") };
}

export default async function NewQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;

  const [settings, branding] = await Promise.all([
    getSettings(),
    getDocumentBranding("html"),
  ]);
  const today = todayInTimeZone(settings.region.timezone);
  const defaults = {
    today,
    validityDays: settings.quote.validityDays,
    taxRate: settings.quote.defaultTaxRate,
    salesperson: settings.quote.defaultSalesperson,
    notes: settings.quote.defaultNotes,
    terms: settings.quote.defaultTerms,
  };

  let initialValues = newQuoteValues(defaults);
  let duplicatedFrom: { id: number; quotationNumber: string } | null = null;
  let prefilledCustomer: string | null = null;

  const fromId = parseQuoteId(first(query.from));
  if (fromId !== null) {
    const source = await getQuoteById(fromId);
    if (source) {
      initialValues = duplicateQuoteValues(formValuesFromRecord(source), defaults);
      duplicatedFrom = { id: source.id, quotationNumber: source.quotationNumber };
    }
  }

  const customerName = first(query.customer).trim().slice(0, 200);
  if (!duplicatedFrom && customerName) {
    const customer = await getLatestCustomerByName(customerName);
    if (customer) {
      initialValues = withCustomer(initialValues, customer);
      prefilledCustomer = customer.companyName;
    } else {
      initialValues = { ...initialValues, companyName: customerName };
    }
  }

  return (
    <QuoteForm
      mode="create"
      initialValues={initialValues}
      draftKey={quoteDraftKey()}
      today={today}
      branding={branding}
      duplicatedFrom={duplicatedFrom}
      prefilledCustomer={prefilledCustomer}
    />
  );
}
