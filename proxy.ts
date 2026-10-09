import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./navigation";
import { loginPath, localeFromPath } from "./lib/auth/paths";
import { decideProxyAction } from "./lib/auth/proxy-rules";
import { SESSION_COOKIE, authEnabled, verifySessionToken } from "./lib/auth/session";
import type { AppLocale } from "./i18n/locales";

const intl = createMiddleware(routing);

// For an unprefixed path next-intl answers with a redirect to /<locale>/…,
// resolved from the NEXT_LOCALE cookie, then Accept-Language, then the default.
// Reusing it keeps the login redirect's locale identical to that negotiation.
function negotiateLocale(req: NextRequest): AppLocale {
  const location = intl(req).headers.get("location");
  if (location) {
    const locale = localeFromPath(new URL(location, req.url).pathname);
    if (locale) return locale;
  }
  return routing.defaultLocale;
}

export default async function proxy(req: NextRequest) {
  const enabled = authEnabled();
  const decision = decideProxyAction({
    pathname: req.nextUrl.pathname,
    search: req.nextUrl.search,
    method: req.method.toUpperCase(),
    isServerAction: req.headers.has("next-action"),
    authEnabled: enabled,
    authenticated: enabled && (await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)),
  });

  switch (decision.action) {
    case "next":
      return NextResponse.next();
    case "notFound":
      return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    case "intl":
      return intl(req);
    case "unauthorized":
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    case "redirect":
      return NextResponse.redirect(new URL(decision.location, req.url), 307);
    case "login": {
      const locale = decision.locale ?? negotiateLocale(req);
      return NextResponse.redirect(new URL(loginPath(locale, decision.next), req.url), 307);
    }
  }
}

export const config = {
  // Everything except build assets. Paths ending in an extension are NOT
  // skipped: /en/quotes/1.0 is a page, and an unchecked /favicon.ico reaches
  // [locale] and renders its page. proxy-rules lets the PWA assets through.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
