import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, type AppLocale } from "@/i18n/locales";
import { assertAuthenticated, isUnauthenticatedError } from "@/lib/auth/guard";
import { jsonError } from "@/lib/auth/http";
import { isAppLocale } from "@/lib/auth/paths";
import { todayInTimeZone } from "@/lib/dates";
import { getCachedPdf, pdfCacheKey, setCachedPdf } from "@/lib/pdf/cache";
import { localizedPdfDisposition } from "@/lib/pdf/labels";
import { loadQuoteForPdf, renderQuotePdf } from "@/lib/pdf/quote-pdf";
import { getDocumentBranding, getSettings } from "@/services/settings";

// react-pdf and the fonts need Node (fs, Buffer); never prerender.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DB_ID = 2_147_483_647;

/** Digits only and within int4: anything else is a 404, never a 500. */
function parseId(raw: string): number | null {
  if (!/^\d{1,10}$/.test(raw)) return null;
  const id = Number(raw);
  return id >= 1 && id <= MAX_DB_ID ? id : null;
}

/** ?lang= → NEXT_LOCALE cookie → default. */
function pdfLanguage(req: NextRequest): AppLocale {
  const param = req.nextUrl.searchParams.get("lang");
  if (isAppLocale(param)) return param;
  const cookie = req.cookies.get("NEXT_LOCALE")?.value;
  return isAppLocale(cookie) ? cookie : DEFAULT_LOCALE;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await assertAuthenticated();
  } catch (error) {
    if (isUnauthenticatedError(error)) return jsonError("UNAUTHENTICATED", 401);
    throw error;
  }

  const id = parseId((await params).id);
  if (id === null) return jsonError("NOT_FOUND", 404);
  const lang = pdfLanguage(req);
  const download = req.nextUrl.searchParams.get("download") === "1";

  try {
    const quote = await loadQuoteForPdf(id);
    if (!quote) return jsonError("NOT_FOUND", 404);

    const settings = await getSettings();
    const today = todayInTimeZone(settings.region.timezone);
    // Legacy rows may lack updated_at; without it an edit could not bust the entry.
    const key = quote.updatedAt
      ? pdfCacheKey({ id, updatedAt: quote.updatedAt, lang, version: settings.version, today })
      : null;

    let pdf = key ? getCachedPdf(key) : null;
    const hit = pdf !== null;
    if (!pdf) {
      const branding = await getDocumentBranding("pdf");
      pdf = await renderQuotePdf(quote, branding, { lang, today });
      if (key) setCachedPdf(key, pdf);
    }

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdf.byteLength),
        "Content-Disposition": localizedPdfDisposition(
          download ? "attachment" : "inline",
          quote.quotationNumber,
          lang
        ),
        // Customer PII: never in shared caches or the service worker.
        "Cache-Control": "private, no-store",
        "X-Pdf-Cache": hit ? "hit" : "miss",
      },
    });
  } catch (error) {
    console.error(`PDF generation failed for quote ${id}:`, error);
    return jsonError("INTERNAL", 500);
  }
}
