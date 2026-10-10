import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { brandHex } from "@/lib/brand-color";
import { buildManifest, negotiateManifestLocale } from "@/lib/pwa/manifest";
import { getIconVersion } from "@/lib/pwa/render-icon";
import { getPublicConfig } from "@/services/settings";

// Runtime settings (name, brand colour, icon): never frozen at build time.
export const dynamic = "force-dynamic";

/**
 * Browsers fetch the manifest without cookies, so only Accept-Language says
 * which language to use, and only for text that may change silently
 * (description, shortcut names). The app's name is the same for everyone.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = negotiateManifestLocale((await headers()).get("accept-language"));
  const [config, iconVersion, t] = await Promise.all([
    getPublicConfig(),
    getIconVersion(),
    getTranslations({ locale, namespace: "Pwa.manifest" }),
  ]);
  return buildManifest({
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
}
