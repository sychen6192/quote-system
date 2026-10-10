import type { NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALES, type AppLocale } from "@/i18n/locales";
import { assertAuthenticated, isUnauthenticatedError } from "@/lib/auth/guard";
import { todayInTimeZone } from "@/lib/dates";
import { buildQuotesCsv, exportFilename } from "@/services/export";
import { getSettings } from "@/services/settings";

export const dynamic = "force-dynamic";

function pickLocale(...candidates: (string | null | undefined)[]): AppLocale {
  for (const c of candidates) {
    if ((LOCALES as readonly string[]).includes(c ?? "")) return c as AppLocale;
  }
  return DEFAULT_LOCALE;
}

/** GET /api/export/quotes?q=&status=&sort=&lang= → CSV of every matching quote. */
export async function GET(request: NextRequest) {
  try {
    await assertAuthenticated();
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return Response.json(
        { error: "UNAUTHORIZED" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
    throw error;
  }

  const params = request.nextUrl.searchParams;
  try {
    const settings = await getSettings();
    const today = todayInTimeZone(settings.region.timezone);
    const csv = await buildQuotesCsv(
      {
        q: params.get("q"),
        status: params.get("status"),
        sort: params.get("sort"),
        today,
      },
      {
        locale: pickLocale(params.get("lang"), request.cookies.get("NEXT_LOCALE")?.value),
        currency: settings.money.currency,
        fractionDigits: settings.money.fractionDigits,
      }
    );
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFilename(today)}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("CSV export failed:", error);
    return Response.json(
      { error: "INTERNAL" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
