import { decideProxyAction, isPublicPath, type ProxyInput } from "@/lib/auth/proxy-rules";

const base: ProxyInput = {
  pathname: "/",
  search: "",
  method: "GET",
  isServerAction: false,
  authEnabled: true,
  authenticated: false,
};
const decide = (overrides: Partial<ProxyInput>) => decideProxyAction({ ...base, ...overrides });

describe("isPublicPath", () => {
  it.each([
    "/api/health",
    "/api/auth/login",
    "/api/auth/logout",
    "/api/branding/logo",
    "/api/branding/icon",
    "/api/branding-icon",
    "/en/login",
    "/zh-TW/login",
  ])("%s is public", (p) => expect(isPublicPath(p)).toBe(true));

  // The company seal authenticates documents: only signed-in views need it
  // (PDFs embed it as a data URI), so it is not handed to anonymous visitors.
  it.each(["/api/branding/stamp", "/api/branding/other", "/api/branding/logo.png"])(
    "%s is private",
    (p) => expect(isPublicPath(p)).toBe(false)
  );

  it.each([
    "/",
    "/en",
    "/en/quotes",
    "/en/login/extra",
    "/fr/login",
    "/zh-tw/login",
    "/login",
    "/api/health/x",
    "/api/healthz",
    "/api/auth",
    "/api/auth/a/b",
    "/api/branding",
    "/api/branding/logo/x",
    "/api/quotes/1/pdf",
    "/api/export/quotes",
    "/API/health",
  ])("%s is private", (p) => expect(isPublicPath(p)).toBe(false));
});

// Next renders a page in parallel with its layout, so the [locale] layout's
// notFound() does not stop e.g. the dashboard from rendering (into the 404's
// RSC payload) for /favicon.ico. Nothing may reach [locale] unchecked.
describe("decideProxyAction: file-like paths", () => {
  const publicAssets = [
    "/robots.txt",
    "/sw.js",
    "/manifest.webmanifest",
    "/offline.html",
    "/icons/any-192.png",
    "/icons/apple-180.png",
  ];

  it.each([true, false])("serves the PWA assets untouched (auth enabled: %s)", (authEnabled) => {
    for (const pathname of publicAssets) {
      expect(decide({ pathname, authEnabled })).toEqual({ action: "next" });
    }
  });

  it.each([true, false])("404s any other top-level name with a dot (auth enabled: %s)", (authEnabled) => {
    for (const pathname of [
      "/favicon.ico",
      "/apple-touch-icon.png",
      "/robots.txt.bak",
      "/robots.txt/x",
      "/foo.json",
      "/a.b",
      "/en.json",
      "/en%2Fquotes%2F1.0",
      "/.well-known/appspecific/com.chrome.devtools.json",
      "/sw.js/x",
    ]) {
      expect(decide({ pathname, authEnabled })).toEqual({ action: "notFound" });
      expect(decide({ pathname, authEnabled, authenticated: true })).toEqual({ action: "notFound" });
    }
  });

  it("still guards dotted paths below a locale or /api", () => {
    expect(decide({ pathname: "/en/quotes/1.0" })).toEqual({ action: "login", locale: "en", next: "/en/quotes/1.0" });
    expect(decide({ pathname: "/x/quotes/1.0" })).toMatchObject({ action: "login", locale: null });
    expect(decide({ pathname: "/api/quotes/1.0" })).toEqual({ action: "unauthorized" });
    expect(decide({ pathname: "/en/quotes/1.0", authenticated: true })).toEqual({ action: "intl" });
  });

  it("only treats single file names under /icons as assets", () => {
    expect(decide({ pathname: "/icons/quotes" })).toMatchObject({ action: "login" });
    expect(decide({ pathname: "/icons/quotes/1.png" })).toMatchObject({ action: "login" });
  });

  it("never runs a Server Action at an asset URL", () => {
    expect(decide({ pathname: "/sw.js", isServerAction: true, method: "POST" })).toEqual({ action: "notFound" });
    expect(decide({ pathname: "/robots.txt", isServerAction: true, method: "POST" })).toEqual({ action: "notFound" });
    expect(decide({ pathname: "/robots.txt", method: "POST" })).toEqual({ action: "notFound" });
    expect(decide({ pathname: "/icons/a.png", method: "POST" })).toEqual({ action: "unauthorized" });
  });
});

describe("decideProxyAction: auth disabled", () => {
  it("only localises pages and leaves /api alone", () => {
    const off = { authEnabled: false };
    expect(decide({ ...off, pathname: "/en/quotes" })).toEqual({ action: "intl" });
    expect(decide({ ...off, pathname: "/quotes/new" })).toEqual({ action: "intl" });
    expect(decide({ ...off, pathname: "/api/quotes/1/pdf" })).toEqual({ action: "next" });
    expect(decide({ ...off, pathname: "/en/quotes", isServerAction: true })).toEqual({ action: "intl" });
    expect(decide({ ...off, pathname: "/en/quotes", method: "POST" })).toEqual({ action: "intl" });
  });
});

describe("decideProxyAction: auth enabled, not signed in", () => {
  it("lets public paths through", () => {
    expect(decide({ pathname: "/api/health" })).toEqual({ action: "next" });
    expect(decide({ pathname: "/api/auth/login" })).toEqual({ action: "next" });
    expect(decide({ pathname: "/api/branding/logo" })).toEqual({ action: "next" });
    expect(decide({ pathname: "/api/branding-icon" })).toEqual({ action: "next" });
    expect(decide({ pathname: "/en/login" })).toEqual({ action: "intl" });
  });

  it("answers 401 for private API routes", () => {
    expect(decide({ pathname: "/api/quotes/1/pdf" })).toEqual({ action: "unauthorized" });
    expect(decide({ pathname: "/api/export/quotes" })).toEqual({ action: "unauthorized" });
    expect(decide({ pathname: "/api" })).toEqual({ action: "unauthorized" });
  });

  it("answers 401 for Server Actions, even on public pages", () => {
    for (const pathname of ["/en/quotes", "/en/login", "/zh-TW/login", "/api/health", "/"]) {
      expect(decide({ pathname, isServerAction: true })).toEqual({ action: "unauthorized" });
    }
  });

  // Next also runs Server Actions from no-JS form posts (multipart body with a
  // $ACTION_ID_ field) that carry no next-action header.
  it("answers 401 for any non-GET page request, even on the login page", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      for (const pathname of ["/en/login", "/zh-TW/login", "/en/quotes", "/", "/quotes/new"]) {
        expect(decide({ pathname, method })).toEqual({ action: "unauthorized" });
      }
    }
    expect(decide({ pathname: "/en/login", method: "HEAD" })).toEqual({ action: "intl" });
    expect(decide({ pathname: "/en/quotes", method: "HEAD" })).toMatchObject({ action: "login" });
  });

  it("still lets the public API routes take POSTs", () => {
    expect(decide({ pathname: "/api/auth/login", method: "POST" })).toEqual({ action: "next" });
    expect(decide({ pathname: "/api/auth/logout", method: "POST" })).toEqual({ action: "next" });
    expect(decide({ pathname: "/api/quotes/1/pdf", method: "POST" })).toEqual({ action: "unauthorized" });
  });

  it("redirects pages to the login page of their locale", () => {
    expect(decide({ pathname: "/en/quotes", search: "?status=sent" })).toEqual({
      action: "login",
      locale: "en",
      next: "/en/quotes?status=sent",
    });
    expect(decide({ pathname: "/zh-TW" })).toEqual({ action: "login", locale: "zh-TW", next: "/zh-TW" });
  });

  it("leaves the locale to negotiation for unprefixed pages", () => {
    expect(decide({ pathname: "/quotes/new" })).toEqual({ action: "login", locale: null, next: "/quotes/new" });
    expect(decide({ pathname: "/" })).toEqual({ action: "login", locale: null, next: "/" });
  });

  it("drops the router's _rsc param from next", () => {
    expect(decide({ pathname: "/en/quotes", search: "?_rsc=abc" })).toMatchObject({ next: "/en/quotes" });
    expect(decide({ pathname: "/en/quotes", search: "?page=2&_rsc=abc" })).toMatchObject({
      next: "/en/quotes?page=2",
    });
  });

  it("does not treat lookalike or nested login paths as public", () => {
    expect(decide({ pathname: "/en/login/x" })).toMatchObject({ action: "login" });
    expect(decide({ pathname: "/fr/login" })).toMatchObject({ action: "login", locale: null });
  });

  it("passes Next internals through untouched", () => {
    expect(decide({ pathname: "/_next/webpack-hmr" })).toEqual({ action: "next" });
    expect(decide({ pathname: "/_next/mcp" })).toEqual({ action: "next" });
    expect(decide({ pathname: "/_next/static/chunks/a.js" })).toEqual({ action: "next" });
    expect(decide({ pathname: "/_next/image", search: "?url=%2Fx.png&w=64&q=75" })).toEqual({ action: "next" });
    expect(decide({ pathname: "/_next/x", isServerAction: true })).toEqual({ action: "unauthorized" });
    expect(decide({ pathname: "/_next/quotes/1", method: "POST" })).toEqual({ action: "unauthorized" });
  });
});

// Next routes /_next/<page> into [locale] with locale "_next"; the layout's
// notFound() does not stop the page, which renders its data into the 404.
describe("decideProxyAction: /_next/ is never a page", () => {
  const leaky = [
    "/_next/quotes/1",
    "/_next/quotes/1/edit",
    "/_next/quotes/new",
    "/_next/settings",
    "/_next/customers",
    "/_next",
    "/_next/",
    "/_next/static",
    "/_next/imagex",
    "/_next/webpack-hmr/x",
    "/_next/data/build/en.json",
  ];

  it.each([
    ["auth on, signed out", { authEnabled: true, authenticated: false }],
    ["auth on, signed in", { authEnabled: true, authenticated: true }],
    ["auth off", { authEnabled: false, authenticated: false }],
  ])("404s /_next/<anything else> (%s)", (_label, auth) => {
    for (const pathname of leaky) {
      const d = decide({ ...auth, pathname });
      // "/_next" itself is an ordinary unprefixed page path (no leak: the
      // proxy guards it like any other).
      if (pathname === "/_next") {
        expect(d.action).not.toBe("next");
        continue;
      }
      expect(d).toEqual({ action: "notFound" });
    }
  });

  it("still lets Next's own endpoints through with auth off", () => {
    expect(decide({ authEnabled: false, pathname: "/_next/webpack-hmr" })).toEqual({ action: "next" });
  });
});

describe("decideProxyAction: auth enabled, signed in", () => {
  const signedIn = { authenticated: true };

  it("lets everything through", () => {
    expect(decide({ ...signedIn, pathname: "/en/quotes" })).toEqual({ action: "intl" });
    expect(decide({ ...signedIn, pathname: "/quotes/new" })).toEqual({ action: "intl" });
    expect(decide({ ...signedIn, pathname: "/api/quotes/1/pdf" })).toEqual({ action: "next" });
    expect(decide({ ...signedIn, pathname: "/en/quotes", isServerAction: true })).toEqual({ action: "intl" });
  });

  it("lets signed-in form posts through", () => {
    expect(decide({ ...signedIn, pathname: "/en/quotes", method: "POST" })).toEqual({ action: "intl" });
  });

  it("sends the login page home, or to a safe next", () => {
    expect(decide({ ...signedIn, pathname: "/zh-TW/login" })).toEqual({ action: "redirect", location: "/zh-TW" });
    expect(decide({ ...signedIn, pathname: "/en/login", search: "?next=%2Fen%2Fquotes%2F3" })).toEqual({
      action: "redirect",
      location: "/en/quotes/3",
    });
    expect(decide({ ...signedIn, pathname: "/en/login", search: "?next=%2F%2Fevil.example" })).toEqual({
      action: "redirect",
      location: "/en",
    });
  });

  // URL parsing collapses dot segments into a protocol-relative "//evil".
  it.each([
    "?next=%2F.%2F%2Fevil.example",
    "?next=%2Fa%2F..%2F%2Fevil.example",
    "?next=%2Fen%2F..%2F%2Fevil.example%2Flogin",
    "?next=%2F%252e%2F%2Fevil.example",
    "?next=%2F%2e%2F%2Fevil.example",
  ])("never redirects off-site after dot-segment normalisation (%s)", (search) => {
    expect(decide({ ...signedIn, pathname: "/en/login", search })).toEqual({ action: "redirect", location: "/en" });
  });

  it("never redirects the login page to itself", () => {
    expect(decide({ ...signedIn, pathname: "/en/login", search: "?next=%2Fzh-TW%2Flogin%3Fx%3D1" })).toEqual({
      action: "redirect",
      location: "/en",
    });
  });
});
