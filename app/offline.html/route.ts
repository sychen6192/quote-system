import { getTranslations } from "next-intl/server";
import { LOCALES, type AppLocale } from "@/i18n/locales";
import { brandPalette } from "@/lib/brand-color";
import { renderOfflinePage, type OfflinePageText } from "@/lib/pwa/offline-page";
import { iconDataUri } from "@/lib/pwa/render-icon";
import { brandDisplayName } from "@/components/app-shell/brand-name";
import { getPublicConfig } from "@/services/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// globals.css :root / .dark --primary and --primary-foreground (default brand).
const DEFAULT_PRIMARY = {
  light: { background: "224 76% 48%", foreground: "0 0% 100%" },
  dark: { background: "217 91% 62%", foreground: "222 47% 7%" },
};

const hsl = (token: string) => `hsl(${token})`;

/**
 * The page the service worker shows for a navigation it cannot fetch. Public
 * (proxy-rules allow-lists it) and precached at install, so it holds nothing
 * beyond the brand name and icon.
 */
export async function GET() {
  const config = await getPublicConfig();
  const entries = await Promise.all(
    LOCALES.map(async (locale) => {
      const [t, tMeta] = await Promise.all([
        getTranslations({ locale, namespace: "Pwa.offlinePage" }),
        getTranslations({ locale, namespace: "Metadata" }),
      ]);
      const name = brandDisplayName(config, locale, tMeta("title"));
      const text: OfflinePageText = {
        title: t("title"),
        description: t("description"),
        retry: t("retry"),
        checking: t("checking"),
        stillOffline: t("stillOffline"),
        autoReload: t("autoReload"),
        whileOffline: t("whileOffline"),
        tipDrafts: t("tipDrafts"),
        tipConnection: t("tipConnection"),
      };
      return { locale, name, text };
    })
  );

  const palette = brandPalette(config.brandColor);
  const primary = palette
    ? {
        light: { background: palette.light.primary, foreground: palette.light["primary-foreground"] },
        dark: { background: palette.dark.primary, foreground: palette.dark["primary-foreground"] },
      }
    : DEFAULT_PRIMARY;

  const html = renderOfflinePage({
    text: Object.fromEntries(entries.map((e) => [e.locale, e.text])) as Record<AppLocale, OfflinePageText>,
    names: Object.fromEntries(entries.map((e) => [e.locale, e.name])) as Record<AppLocale, string>,
    iconDataUri: await iconDataUri("any-192.png"),
    primary: {
      light: { background: hsl(primary.light.background), foreground: hsl(primary.light.foreground) },
      dark: { background: hsl(primary.dark.background), foreground: hsl(primary.dark.foreground) },
    },
  });

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
