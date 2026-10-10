// Pure routing rules for the app shell (no React), shared by the top nav, the
// mobile tab bar and the layout. Pathnames are locale-less ("/quotes/12"),
// as next-intl's usePathname() returns them.

export type NavKey = "dashboard" | "quotes" | "customers" | "settings";

export const NAV_ITEMS: readonly { key: NavKey; href: string }[] = [
  { key: "dashboard", href: "/" },
  { key: "quotes", href: "/quotes" },
  { key: "customers", href: "/customers" },
  { key: "settings", href: "/settings" },
];

export const NEW_QUOTE_HREF = "/quotes/new";

function normalize(pathname: string): string {
  const path = (pathname || "/").split(/[?#]/)[0];
  return path.length > 1 ? path.replace(/\/+$/, "") || "/" : "/";
}

/** The section a nav link stands for is open (exact for the dashboard). */
export function isNavActive(href: string, pathname: string): boolean {
  const path = normalize(pathname);
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

// Pages with their own sticky bottom action bar (quote form and detail): the
// tab bar would cover it. Add a pattern here for any new page that does.
const OWN_ACTION_BAR: readonly RegExp[] = [
  /^\/quotes\/new$/,
  /^\/quotes\/\d+$/,
  /^\/quotes\/\d+\/edit$/,
];

// Pages without any app chrome (no top nav, no tab bar).
const BARE_PAGES: readonly RegExp[] = [/^\/login$/];

export type ShellChrome = {
  /** top nav + skip link */
  nav: boolean;
  /** mobile bottom tab bar (and the bottom padding that reserves its space) */
  tabBar: boolean;
};

export function shellChrome(pathname: string): ShellChrome {
  const path = normalize(pathname);
  if (BARE_PAGES.some((re) => re.test(path))) return { nav: false, tabBar: false };
  return { nav: true, tabBar: !OWN_ACTION_BAR.some((re) => re.test(path)) };
}
