import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { StatusBadge } from "./quote-status-badge";
import { QuoteRowActions } from "./quote-row-actions";
import { ValidUntil } from "./valid-until";
import type { QuoteRowView } from "./quote-row";

/**
 * Phone (< md) quote list. Tables squeeze CJK customer names into
 * one-character columns on narrow screens; each quote is a tappable card,
 * with its actions in a ⋯ menu.
 */
export function QuoteCards({
  rows,
  showActions = true,
}: {
  rows: QuoteRowView[];
  showActions?: boolean;
}) {
  const t = useTranslations("QuotesList");

  return (
    <ul className="space-y-3 md:hidden">
      {rows.map((row) => {
        const name = row.customerName ?? t("unknownCustomer");
        return (
          <li
            key={row.id}
            className="relative rounded-xl border bg-card p-4 shadow-card transition-colors active:bg-muted/60 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    href={`/quotes/${row.id}`}
                    aria-label={t("openQuote", { number: row.number })}
                    className="text-sm font-medium tabular-nums text-muted-foreground outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']"
                  >
                    {row.number}
                  </Link>
                  <StatusBadge status={row.status} />
                </div>
                <p className="truncate text-base font-semibold leading-snug text-foreground">
                  {name}
                </p>
                {row.title ? (
                  <p className="truncate text-sm text-muted-foreground">{row.title}</p>
                ) : null}
              </div>
              {showActions ? (
                <div className="relative z-10 -mr-2 -mt-2 shrink-0">
                  <QuoteRowActions id={row.id} quotationNumber={row.number} />
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex items-end justify-between gap-3 border-t pt-3">
              <ValidUntil row={row} withLabel className="min-w-0 text-xs" />
              <span className="money shrink-0 text-base font-semibold text-foreground">
                {row.total}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
