// QuoteView + branding → the email template's props, all text pre-formatted.
// Pure; kept apart from the template so the server action can be tested
// with the template mocked.
import {
  documentMoney,
  formatDocumentDate,
  formatTotal,
  present,
} from "@/components/quote-document/format";
import type { AppLocale } from "@/i18n/locales";
import { pickCompanyName } from "@/lib/company-name";
import type { QuoteView } from "@/lib/quote-view";
import type { DocumentBranding } from "@/lib/settings/types";
import { quoteEmailLabels } from "./labels";
import type { QuoteEmailProps } from "./quote-template";

export function quoteEmailProps({
  view,
  branding,
  lang,
  message,
  attachmentName,
}: {
  view: QuoteView;
  branding: DocumentBranding;
  lang: AppLocale;
  message?: string | null;
  attachmentName: string;
}): QuoteEmailProps {
  const labels = quoteEmailLabels(lang);
  const { company, payment } = branding;
  const name = pickCompanyName(company.name, company.nameLocal, lang);
  const altName =
    [company.name, company.nameLocal].map((n) => n.trim()).find((n) => n && n !== name) ?? null;
  return {
    lang,
    labels,
    brandColor: branding.brandColor,
    company: {
      name,
      altName,
      address: present(company.address),
      phone: present(company.phone),
      email: present(company.email),
      website: present(company.website),
    },
    quote: {
      number: view.quotationNumber ?? "",
      title: view.title,
      validUntil: formatDocumentDate(view.validUntil, lang),
      total: formatTotal(
        view.totals.total,
        documentMoney(view, {
          currency: branding.currency,
          currencyLocale: branding.currencyLocale,
          fractionDigits: branding.fractionDigits,
        })
      ),
      recipientName: view.customer.contactPerson ?? view.customer.companyName,
    },
    message: present(message ?? null),
    payment: payment
      ? [
          { label: labels.bankName, value: present(payment.bankName) },
          { label: labels.bankCode, value: present(payment.bankCode) },
          { label: labels.accountName, value: present(payment.accountName) },
          { label: labels.accountNumber, value: present(payment.accountNumber) },
        ].filter((row): row is { label: string; value: string } => row.value !== null)
      : [],
    footerText: present(branding.footerText),
    attachmentName,
  };
}

