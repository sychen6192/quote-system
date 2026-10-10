import { DEFAULT_LOCALE, LOCALES, type AppLocale } from "@/i18n/locales";

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** The locale prefix of a pathname (`/zh-TW/quotes` → `zh-TW`), or null. */
export function localeFromPath(pathname: string): AppLocale | null {
  const seg = pathname.split("/")[1];
  return isAppLocale(seg) ? seg : null;
}

const PROBE_ORIGIN = "http://next-path.invalid";

// Browsers strip tabs/newlines and treat `\` like `/` in URLs, so `/\t/evil`
// or `/\evil` would become protocol-relative.
function hasUnsafeChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 || c === 0x7f || c === 0x5c) return true;
  }
  return false;
}

/**
 * Only same-site absolute paths survive; anything that a browser could
 * resolve to another origin (`//evil`, `/\evil`, `/<TAB>/evil`, `https:…`)
 * falls back. The check runs on the raw value AND on the normalised result:
 * dot segments collapse, so `/.//evil` or `/a/..//evil` parse to `//evil`.
 */
export function safeNextPath(raw: unknown, fallback = `/${DEFAULT_LOCALE}`): string {
  if (typeof raw !== "string" || raw.length > 2048) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (hasUnsafeChar(raw)) return fallback;
  try {
    const url = new URL(raw, PROBE_ORIGIN);
    if (url.origin !== PROBE_ORIGIN) return fallback;
    const out = `${url.pathname}${url.search}${url.hash}`;
    if (!out.startsWith("/") || out.startsWith("//") || hasUnsafeChar(out)) return fallback;
    return out;
  } catch {
    return fallback;
  }
}

export function loginPath(locale: AppLocale, next?: string | null): string {
  const base = `/${locale}/login`;
  return next ? `${base}?next=${encodeURIComponent(next)}` : base;
}
