import "server-only";
import { redirect } from "next/navigation";
import type { AppLocale } from "@/i18n/locales";
import { isAuthenticated } from "@/lib/auth/guard";
import { loginPath, safeNextPath } from "@/lib/auth/paths";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The page's own URL (`/zh-TW/quotes?status=sent`), for the sign-in page to
 * lead back to. `path` is the part after the locale ("" for the dashboard).
 */
export function pagePath(locale: AppLocale, path: string, searchParams?: SearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      query.append(key, item);
    }
  }
  const search = query.toString();
  return `/${locale}${path === "/" ? "" : path}${search ? `?${search}` : ""}`;
}

/**
 * Defence in depth behind proxy.ts, first thing in every page, layout and
 * metadata function that reads private data: a signed-out request is sent to
 * the sign-in page before anything is loaded (a route the proxy missed, like
 * the old /_next/<page> leak, renders nothing private). A no-op without
 * APP_PASSWORD.
 */
export async function requireSession(locale: AppLocale, currentPath: string): Promise<void> {
  if (await isAuthenticated()) return;
  redirect(loginPath(locale, safeNextPath(currentPath, `/${locale}`)));
}
