// Loads and renders quote PDFs (the /api/quotes/[id]/pdf route and the
// email attachment).
import "server-only";
import { asc, eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/db";
import { quotationItems, quotations } from "@/db/schema";
import { QuotePDFDocument } from "@/components/pdf/QuotePDFDocument";
import type { AppLocale } from "@/i18n/locales";
import { minorUnitStep } from "@/lib/money";
import { quoteViewFromRecord, type QuoteRecord } from "@/lib/quote-view";
import type { DocumentBranding } from "@/lib/settings/types";
import { registerPdfFonts } from "./fonts";
import { pdfDocumentLabels } from "./labels";

/** The quote with its customer and items in display order, or null. */
export async function loadQuoteForPdf(id: number) {
  const quote = await db.query.quotations.findFirst({
    where: eq(quotations.id, id),
    with: {
      customer: true,
      items: { orderBy: [asc(quotationItems.position), asc(quotationItems.id)] },
    },
  });
  return quote ?? null;
}

export type QuoteForPdf = NonNullable<Awaited<ReturnType<typeof loadQuoteForPdf>>>;

export type RenderQuotePdfOptions = {
  lang: AppLocale;
  /** YYYY-MM-DD in the business timezone */
  today: string;
};

/** @param branding getDocumentBranding("pdf") — images must be data URIs */
export async function renderQuotePdf(
  quote: QuoteRecord,
  branding: DocumentBranding,
  { lang, today }: RenderQuotePdfOptions
): Promise<Uint8Array<ArrayBuffer>> {
  registerPdfFonts();
  const buffer = await renderToBuffer(
    <QuotePDFDocument
      view={quoteViewFromRecord(quote, { today, minorUnitStep: minorUnitStep(branding.fractionDigits) })}
      branding={branding}
      labels={pdfDocumentLabels(lang)}
      lang={lang}
    />
  );
  return new Uint8Array(buffer);
}
