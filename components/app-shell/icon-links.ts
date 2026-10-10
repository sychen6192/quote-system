// Pure: the <head> icon links of every page.
import type { Metadata } from "next";
import { iconUrl } from "@/lib/pwa/icons";

/**
 * Favicon, any-192 and Apple touch icon, under the `?v=` token that
 * /icons/* checks before caching a response for a year (getIconVersion,
 * iconCacheControl). Any other token (e.g. the settings version) gets a
 * five-minute cache instead.
 */
export function appIconLinks(iconVersion: string): NonNullable<Metadata["icons"]> {
  return {
    icon: [
      { url: iconUrl("favicon-32.png", iconVersion), sizes: "32x32", type: "image/png" },
      { url: iconUrl("any-192.png", iconVersion), sizes: "192x192", type: "image/png" },
    ],
    apple: iconUrl("apple-180.png", iconVersion),
  };
}
