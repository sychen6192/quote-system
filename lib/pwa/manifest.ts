// Web app manifest (spec §9). Pure: app/manifest.webmanifest/route.ts feeds it the runtime config.
import type { MetadataRoute } from "next";
import { LOCALES, DEFAULT_LOCALE, type AppLocale } from "@/i18n/locales";
import { shortAppName } from "@/components/app-shell/brand-name";
import { iconUrl, type IconFile } from "./icons";

export const MAX_SHORT_NAME_LENGTH = 12;

/** Light page background; also the Android splash screen colour. */
export const MANIFEST_BACKGROUND = "#ffffff";

/**
 * A launcher label of at most 12 characters: the name without its legal suffix
 * (shortAppName, as on iOS), then cut at a word boundary when one is close
 * enough, else hard.
 */
export function manifestShortName(name: string, max = MAX_SHORT_NAME_LENGTH): string {
  const stripped = shortAppName(name);
  const chars = Array.from(stripped);
  if (chars.length <= max) return stripped;
  const head = chars.slice(0, max).join("");
  const space = head.lastIndexOf(" ");
  return (space >= Math.ceil(max / 2) ? head.slice(0, space) : head).trim();
}

/**
 * The best supported locale for an Accept-Language header (q-values honoured;
 * any Chinese tag maps to zh-TW, the only Chinese locale).
 */
export function negotiateManifestLocale(acceptLanguage: string | null | undefined): AppLocale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const quality = q ? Number(q.slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter((entry) => entry.tag && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  for (const { tag } of ranked) {
    if (tag === "*") return DEFAULT_LOCALE;
    const exact = LOCALES.find((locale) => locale.toLowerCase() === tag);
    if (exact) return exact;
    const primary = tag.split("-")[0];
    const byLanguage = LOCALES.find((locale) => locale.toLowerCase().split("-")[0] === primary);
    if (byLanguage) return byLanguage;
  }
  return DEFAULT_LOCALE;
}

export type ManifestText = {
  description: string;
  newQuote: string;
  newQuoteDescription: string;
  quotes: string;
  quotesDescription: string;
  customers: string;
  customersDescription: string;
};

export type ManifestInput = {
  /** Installed-app identity: must not depend on the request's language. */
  appName: string;
  /** Validated #RRGGBB brand colour. */
  themeColor: string;
  /** `?v=` token for every icon URL (see iconVersionToken). */
  iconVersion: string;
  text: ManifestText;
};

export function buildManifest({ appName, themeColor, iconVersion, text }: ManifestInput): MetadataRoute.Manifest {
  const icon = (file: IconFile, size: number, purpose: "any" | "maskable") => ({
    src: iconUrl(file, iconVersion),
    sizes: `${size}x${size}`,
    type: "image/png",
    purpose,
  });
  const shortcutIcon = (file: IconFile) => [icon(file, 96, "any")];

  return {
    // Identity: changing id or name makes browsers treat it as another app
    // (or ask the user to approve), so neither follows Accept-Language.
    id: "/",
    name: appName,
    short_name: manifestShortName(appName),
    description: text.description,
    // The proxy sends "/" to the user's locale (cookie, then Accept-Language).
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: MANIFEST_BACKGROUND,
    theme_color: themeColor,
    categories: ["business", "finance", "productivity"],
    icons: [
      // Chrome needs a purpose "any" icon of at least 144 px to install.
      icon("any-192.png", 192, "any"),
      icon("any-512.png", 512, "any"),
      icon("maskable-192.png", 192, "maskable"),
      icon("maskable-512.png", 512, "maskable"),
    ],
    shortcuts: [
      {
        name: text.newQuote,
        description: text.newQuoteDescription,
        url: "/quotes/new",
        icons: shortcutIcon("shortcut-new-96.png"),
      },
      {
        name: text.quotes,
        description: text.quotesDescription,
        url: "/quotes",
        icons: shortcutIcon("shortcut-quotes-96.png"),
      },
      {
        name: text.customers,
        description: text.customersDescription,
        url: "/customers",
        icons: shortcutIcon("shortcut-customers-96.png"),
      },
    ],
    // A launch focuses the open window and navigates it instead of opening a second one.
    launch_handler: { client_mode: "navigate-existing" },
  };
}
