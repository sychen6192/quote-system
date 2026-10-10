// Plain constants (no next-intl imports) so tests and server utilities can use
// them without pulling in ESM-only next-intl modules.
export const LOCALES = ["en", "zh-TW"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "en";

/** next-intl's cookie for the chosen UI language (its default name). */
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";
/**
 * One year, so the chosen language survives closing the browser or the
 * installed app; next-intl's default is a session cookie.
 */
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
