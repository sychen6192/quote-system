// Strings and file names for quote PDFs and email attachments. Reads the
// QuoteDoc messages directly (no request scope), so route handlers, server
// actions and tests get exactly what the HTML document gets from next-intl.
import { buildQuoteDocumentLabels, type QuoteDocumentLabels } from "@/components/quote-document/label-keys";
import { DEFAULT_LOCALE, type AppLocale } from "@/i18n/locales";
import enQuoteDoc from "@/messages/en/QuoteDoc.json";
import zhQuoteDoc from "@/messages/zh-TW/QuoteDoc.json";

const QUOTE_DOC_MESSAGES: Record<AppLocale, Record<string, unknown>> = {
  en: enQuoteDoc,
  "zh-TW": zhQuoteDoc,
};

export function pdfDocumentLabels(lang: AppLocale): QuoteDocumentLabels {
  const messages = QUOTE_DOC_MESSAGES[lang] ?? QUOTE_DOC_MESSAGES[DEFAULT_LOCALE];
  return buildQuoteDocumentLabels((key) => messages[key]);
}

// Reserved on Windows/macOS file systems, plus control characters.
const UNSAFE_FILENAME_CHARS = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;

/** "報價單-QT-20261009-001.pdf" / "Quotation-QT-20261009-001.pdf" */
export function localizedPdfFilename(quotationNumber: string, lang: AppLocale): string {
  const prefix = pdfDocumentLabels(lang).title.trim() || "Quotation";
  return `${prefix}-${quotationNumber.trim()}.pdf`.replace(UNSAFE_FILENAME_CHARS, "_");
}

// RFC 5987 attr-char: ALPHA / DIGIT / "!#$&+-.^_`|~"; everything else is %XX.
function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/**
 * Content-Disposition for a quote PDF. A non-ASCII name (報價單-…) goes in
 * an RFC 6266 `filename*`, with the English name as the plain `filename`
 * for clients that only read that one.
 */
export function localizedPdfDisposition(
  type: "inline" | "attachment",
  quotationNumber: string,
  lang: AppLocale
): string {
  const filename = localizedPdfFilename(quotationNumber, lang);
  const ascii = (name: string) => name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  if (ascii(filename) === filename) return `${type}; filename="${filename}"`;
  const fallback = ascii(localizedPdfFilename(quotationNumber, "en"));
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeRfc5987(filename)}`;
}
