export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected";

const STYLES: Record<QuoteStatus, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200",
  accepted:
    "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-200",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200",
};

export const EXPIRED_STYLE =
  "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200";

export function statusStyle(status: string): string {
  return STYLES[status as QuoteStatus] ?? STYLES.draft;
}
