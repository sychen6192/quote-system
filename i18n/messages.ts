import type { AbstractIntlMessages } from "next-intl";

/**
 * Messages live in messages/<locale>/<Namespace>.json — one file per top-level
 * namespace, so features can add translations without touching shared files.
 *
 * To add a namespace: create the JSON in EVERY locale folder and list its name
 * here. tests/unit/i18n/messages.test.ts fails if a file is missing from this
 * list or if the locales' keys drift apart.
 */
export const MESSAGE_NAMESPACES = [
  "Metadata",
  "Nav",
  "Status",
  "Dashboard",
  "Common",
  "QuotesList",
  "QuoteForm",
  "QuoteActions",
  "Auth",
  "Errors",
  "Validation",
  "UI",
  "Customers",
  "Onboarding",
  "QuoteDoc",
  "QuoteDetail",
  "Email",
  "Settings",
  "Pwa",
] as const;

export async function loadMessages(locale: string): Promise<AbstractIntlMessages> {
  const entries = await Promise.all(
    MESSAGE_NAMESPACES.map(async (ns) => {
      const mod = await import(`../messages/${locale}/${ns}.json`);
      return [ns, mod.default] as const;
    })
  );
  return Object.fromEntries(entries);
}
