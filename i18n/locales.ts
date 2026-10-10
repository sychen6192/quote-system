// Plain constants (no next-intl imports) so tests and server utilities can use
// them without pulling in ESM-only next-intl modules.
export const LOCALES = ["en", "zh-TW"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "en";
