// Loads and renders a quote PDF (used by /api/quotes/[id]/pdf).
import "server-only";
import { asc, eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/db";
import { quotationItems, quotations } from "@/db/schema";
import { QuotePDFDocument } from "@/components/pdf/QuotePDFDocument";
import type { QuoteBranding } from "@/lib/config";
import type { DocumentBranding } from "@/lib/settings/types";
import { registerPdfFonts } from "./fonts";

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

/** DocumentBranding (settings) → the props shape the current PDF template takes. */
export function toQuoteBranding(branding: DocumentBranding, defaultTaxRate: number): QuoteBranding {
  return {
    company: branding.company,
    logoDataUri: branding.logoSrc,
    stampDataUri: branding.stampSrc,
    payment: branding.payment,
    money: {
      currency: branding.currency,
      currencyLocale: branding.currencyLocale,
      defaultTaxRate,
    },
  };
}

/** @param branding getDocumentBranding("pdf") — images must be data URIs */
export async function renderQuotePdf(
  quote: QuoteForPdf,
  branding: DocumentBranding,
  options: { defaultTaxRate: number }
): Promise<Uint8Array<ArrayBuffer>> {
  registerPdfFonts();
  const buffer = await renderToBuffer(
    <QuotePDFDocument quote={quote} branding={toQuoteBranding(branding, options.defaultTaxRate)} />
  );
  return new Uint8Array(buffer);
}
