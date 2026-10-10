import type { NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { LOCALE_COOKIE_NAME } from "@/i18n/locales";
import { isAppLocale } from "@/lib/auth/paths";
import { brandHex } from "@/lib/brand-color";
import { buildManifest, negotiateManifestLocale } from "@/lib/pwa/manifest";
import { getIconVersion } from "@/lib/pwa/render-icon";
import { getPublicConfig } from "@/services/settings";

// A route handler, not app/manifest.ts: Next links a metadata manifest
// without crossorigin, so browsers fetch it without cookies and a login
// proxy in front of the app (Cloudflare Access…) answers with its sign-in
// page. The [locale] layout links this one with crossorigin="use-credentials".
// Runtime settings (name, brand colour, icon): never frozen at build time.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The web app manifest. Public (proxy-rules allow-lists it). Only the text
 * that may change silently (description, shortcut names) follows the
 * language: the UI language cookie when the browser sent credentials, else
 * Accept-Language. The app's name is the same for everyone.
 */
export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(LOCALE_COOKIE_NAME)?.value;
  const locale = isAppLocale(cookie) ? cookie : negotiateManifestLocale(req.headers.get("accept-language"));
  const [config, iconVersion, t] = await Promise.all([
    getPublicConfig(),
    getIconVersion(),
    getTranslations({ locale, namespace: "Pwa.manifest" }),
  ]);
  const manifest = buildManifest({
    appName: config.appName,
    themeColor: brandHex(config.brandColor),
    iconVersion,
    text: {
      description: t("description"),
      newQuote: t("shortcuts.newQuote"),
      newQuoteDescription: t("shortcuts.newQuoteDescription"),
      quotes: t("shortcuts.quotes"),
      quotesDescription: t("shortcuts.quotesDescription"),
      customers: t("shortcuts.customers"),
      customersDescription: t("shortcuts.customersDescription"),
    },
  });

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      // Revalidated on every fetch: a new name, colour or icon shows up on
      // the next check without waiting out a cache lifetime.
      "Cache-Control": "no-cache",
      Vary: "Accept-Language, Cookie",
    },
  });
}
