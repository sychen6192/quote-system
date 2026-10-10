// Setup-checklist state shared by the dashboard (server, cookies) and the
// checklist (client, localStorage). Cookies let the server skip rendering a
// dismissed/finished checklist instead of flashing it on every app start.

export const SETUP_DISMISSED_COOKIE = "qs_setup_dismissed";
export const APP_INSTALLED_COOKIE = "qs_app_installed";

export type SetupItemKey = "company" | "logo" | "firstQuote" | "install";

export const SETUP_ITEMS: readonly { key: SetupItemKey; href: string }[] = [
  { key: "company", href: "/settings" },
  { key: "logo", href: "/settings#branding" },
  { key: "firstQuote", href: "/quotes/new" },
  { key: "install", href: "/settings#about" },
];

export type SetupDone = Record<SetupItemKey, boolean>;

export function setupProgress(done: SetupDone): { done: number; total: number; complete: boolean } {
  const total = SETUP_ITEMS.length;
  const count = SETUP_ITEMS.filter((item) => done[item.key]).length;
  return { done: count, total, complete: count === total };
}
