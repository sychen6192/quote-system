/**
 * The company name to show in the app UI for a given UI locale:
 * Chinese locales get the local name when one is configured.
 * (The invoice document deliberately keeps both names — see the detail page.)
 *
 * Lives outside lib/config.ts so client components can import it without
 * pulling node:fs into the browser bundle.
 */
export function pickCompanyName(
  name: string,
  nameLocal: string,
  locale: string
): string {
  if (locale.toLowerCase().startsWith("zh") && nameLocal.trim()) {
    return nameLocal.trim();
  }
  return name;
}
