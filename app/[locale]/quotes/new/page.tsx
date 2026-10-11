import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pagePath, requireSession } from "@/components/app-shell/require-session";
import {
  SEEDED_DRAFT_MAX_AGE_MS,
  SEEDED_DRAFT_PREFIX,
  quoteDraftKey,
} from "@/components/quote-form/form-model";
import {
  duplicateQuoteValues,
  newQuoteValues,
  withCustomer,
} from "@/components/quote-form/initial-values";
import {
  LAST_SALESPERSON_COOKIE,
  readLastSalesperson,
} from "@/components/quote-form/last-salesperson";
import { QuoteForm } from "@/components/quote-form/quote-form";
import { todayInTimeZone } from "@/lib/dates";
import { formValuesFromRecord } from "@/lib/quote-view";
import { parseQuoteId } from "@/lib/schemas/quote";
import { getLatestCustomerByName } from "@/services/customers";
import { getQuoteById } from "@/services/quotes";
import { getDocumentBranding, getSettings } from "@/services/settings";
import { routing } from "@/navigation";

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
  if (!hasLocale(routing.locales, locale)) notFound();
  const query = await searchParams;
  await requireSession(locale, pagePath(locale, "/quotes/new", query));
  setRequestLocale(locale);

  const [settings, branding, cookieStore] = await Promise.all([
    getSettings(),
    getDocumentBranding("html"),
    cookies(),
  ]);
  const today = todayInTimeZone(settings.region.timezone);
  const defaults = {
    today,
    validityDays: settings.quote.validityDays,
    taxRate: settings.quote.defaultTaxRate,
    // Settings' default salesperson, else whoever saved the last quote on this device.
    salesperson:
      settings.quote.defaultSalesperson ||
      readLastSalesperson(cookieStore.get(LAST_SALESPERSON_COOKIE)?.value),
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
      // Its own draft per source: opening Duplicate or "New quote for X"
      // never overwrites a half-finished blank quote, or the reverse.
      draftKey={quoteDraftKey(
        duplicatedFrom
          ? { from: duplicatedFrom.id }
          : customerName
            ? { customer: prefilledCustomer ?? customerName }
            : null
      )}
      draftPrunePrefix={SEEDED_DRAFT_PREFIX}
      draftPruneMaxAgeMs={SEEDED_DRAFT_MAX_AGE_MS}
      today={today}
      branding={branding}
      duplicatedFrom={duplicatedFrom}
      prefilledCustomer={prefilledCustomer}
    />
  );
}
