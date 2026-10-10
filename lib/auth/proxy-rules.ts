// Pure request-routing rules for proxy.ts (spec §2), kept free of Next/next-intl
// imports so every branch is unit-testable.
import { LOCALES, type AppLocale } from "@/i18n/locales";
import { localeFromPath, safeNextPath } from "./paths";

export type ProxyInput = {
  pathname: string;
  /** Raw query string including the leading "?" (or ""). */
  search: string;
  /** HTTP method, upper case. */
  method: string;
  /** The request carries a `next-action` header (a Server Action call). */
  isServerAction: boolean;
  authEnabled: boolean;
  /** Valid session cookie. Ignored when auth is disabled. */
  authenticated: boolean;
};

export type ProxyDecision =
  /** Pass through untouched (API routes, PWA assets, Next internals). */
  | { action: "next" }
  /** Plain 404 without rendering anything. */
  | { action: "notFound" }
  /** Page route: hand to the next-intl middleware. */
  | { action: "intl" }
  /** 401 JSON (API routes and Server Actions). */
  | { action: "unauthorized" }
  /** 307 to the login page; `locale: null` → negotiate it from the request. */
  | { action: "login"; locale: AppLocale | null; next: string }
  /** 307 to a same-site path. */
  | { action: "redirect"; location: string };

const localeAlternation = LOCALES.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
const LOGIN_PAGE = new RegExp(`^/(${localeAlternation})/login$`);

const PUBLIC_PATHS: readonly RegExp[] = [
  /^\/api\/health$/,
  /^\/api\/auth\/[^/]+$/,
  // Not the stamp: a company seal authenticates documents, and only signed-in
  // pages show it (PDFs embed it as a data URI).
  /^\/api\/branding\/(logo|icon)$/,
  /^\/api\/branding-icon$/,
  LOGIN_PAGE,
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((re) => re.test(pathname));
}

// Fixed public URLs outside [locale] (spec §9). A new public file needs an
// entry here; until then the proxy answers 404 for it (see below).
const PUBLIC_ASSETS: readonly RegExp[] = [
  /^\/sw\.js$/,
  /^\/manifest\.webmanifest$/,
  /^\/offline\.html$/,
  /^\/icons\/[^/]+\.\w+$/,
];

export function isPublicAsset(pathname: string): boolean {
  return PUBLIC_ASSETS.some((re) => re.test(pathname));
}

// A first segment with a dot is never a locale, so such a request can only end
// up in [locale] with an invalid locale. That layout's notFound() does not stop
// its pages, which Next renders in parallel: /favicon.ico would stream the
// dashboard's data inside the 404. Answer those here, before anything renders.
function hasFileLikeFirstSegment(pathname: string): boolean {
  return (pathname.split("/")[1] ?? "").includes(".");
}

function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

// The router's cache-busting param is meaningless after a full redirect.
function withoutRscParam(search: string): string {
  if (!search || search === "?") return "";
  const params = new URLSearchParams(search);
  params.delete("_rsc");
  const s = params.toString();
  return s ? `?${s}` : "";
}

// Next runs a Server Action for a fetch POST with a `next-action` header, and
// also for a no-JS form POST whose multipart body names the action id (no
// header at all). Pages never take other writes, so any non-GET/HEAD request
// to a page is treated as a possible action.
function isPossibleServerAction(req: ProxyInput): boolean {
  if (req.isServerAction) return true;
  return !isApiPath(req.pathname) && req.method !== "GET" && req.method !== "HEAD";
}

export function decideProxyAction(req: ProxyInput): ProxyDecision {
  const { pathname } = req;
  const passThrough: ProxyDecision = isApiPath(pathname) ? { action: "next" } : { action: "intl" };
  const possibleAction = isPossibleServerAction(req);

  // Build assets outside the matcher's exclusions (e.g. dev HMR): never
  // localised, never private. A Server Action posted here still needs auth.
  if (pathname.startsWith("/_next/") && !possibleAction) return { action: "next" };

  if (!possibleAction && isPublicAsset(pathname)) return { action: "next" };
  if (hasFileLikeFirstSegment(pathname)) return { action: "notFound" };

  if (!req.authEnabled) return passThrough;

  // A Server Action can be POSTed to ANY page URL, including the public login
  // page, and runs whatever action id it names: never treat one as public.
  if (!possibleAction && isPublicPath(pathname)) {
    const loginLocale = LOGIN_PAGE.exec(pathname)?.[1] as AppLocale | undefined;
    if (loginLocale && req.authenticated) {
      const home = `/${loginLocale}`;
      const target = safeNextPath(new URLSearchParams(req.search).get("next"), home);
      const targetPath = target.split(/[?#]/)[0];
      return { action: "redirect", location: LOGIN_PAGE.test(targetPath) ? home : target };
    }
    return passThrough;
  }

  if (req.authenticated) return passThrough;

  // A 307 would make the browser re-POST the body to the public login page.
  if (possibleAction || isApiPath(pathname)) return { action: "unauthorized" };

  return {
    action: "login",
    locale: localeFromPath(pathname),
    next: `${pathname}${withoutRscParam(req.search)}`,
  };
}
