// Strings for the quote email (messages/<locale>/Email.json), read directly
// so the server action needs no request-scoped i18n. Pure.
import { fillLabel } from "@/components/quote-document/label-keys";
import { DEFAULT_LOCALE, type AppLocale } from "@/i18n/locales";
import enEmail from "@/messages/en/Email.json";
import zhEmail from "@/messages/zh-TW/Email.json";

export type QuoteEmailLabels = typeof enEmail;
export type QuoteEmailLabelKey = keyof QuoteEmailLabels;

const EMAIL_MESSAGES: Record<AppLocale, QuoteEmailLabels> = {
  en: enEmail,
  "zh-TW": zhEmail,
};

export function quoteEmailLabels(lang: AppLocale): QuoteEmailLabels {
  return EMAIL_MESSAGES[lang] ?? EMAIL_MESSAGES[DEFAULT_LOCALE];
}

/** "報價單 QT-20261009-001 — 艾克米科技" / "Quotation QT-20261009-001 from Acme" (no line breaks). */
export function quoteEmailSubject(lang: AppLocale, quotationNumber: string, company: string): string {
  return fillLabel(quoteEmailLabels(lang).subject, { number: quotationNumber, company })
    .replace(/[\r\n]+/g, " ")
    .trim();
}
