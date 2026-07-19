export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected";

const LIGHT: Record<QuoteStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const DARK: Record<QuoteStatus, string> = {
  draft: "dark:bg-slate-400/20 dark:text-slate-200",
  sent: "dark:bg-blue-400/20 dark:text-blue-200",
  accepted: "dark:bg-green-400/20 dark:text-green-200",
  rejected: "dark:bg-red-400/20 dark:text-red-200",
};

const EXPIRED_LIGHT = "bg-amber-100 text-amber-700";
const EXPIRED_DARK = "dark:bg-amber-400/20 dark:text-amber-200";

function resolve(status: string): QuoteStatus {
  return status in LIGHT ? (status as QuoteStatus) : "draft";
}

/**
 * Tailwind pill classes for a quote status.
 * @param forceLight omit dark: variants — use inside always-light surfaces
 *   (e.g. the printable invoice document, which stays white in dark mode).
 */
export function statusStyle(status: string, forceLight = false): string {
  const s = resolve(status);
  return forceLight ? LIGHT[s] : `${LIGHT[s]} ${DARK[s]}`;
}

export function expiredStyle(forceLight = false): string {
  return forceLight ? EXPIRED_LIGHT : `${EXPIRED_LIGHT} ${EXPIRED_DARK}`;
}
