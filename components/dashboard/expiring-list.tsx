import { CalendarCheck, CalendarClock, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { cn } from "@/lib/utils";
import { SectionCard } from "./section-card";

export type ExpiringItem = {
  id: number;
  number: string;
  customerName: string | null;
  total: string;
  daysLeft: number;
};

/**
 * Open quotes whose validity ends within 7 days, soonest first. `total` is
 * how many there are in all (only the first few are listed).
 */
export function ExpiringList({
  items,
  total = items.length,
  className,
}: {
  items: ExpiringItem[];
  total?: number;
  className?: string;
}) {
  const t = useTranslations("Dashboard.expiring");
  const tList = useTranslations("QuotesList");

  return (
    <SectionCard
      icon={CalendarClock}
      title={t("title")}
      description={t("description")}
      count={total || undefined}
      countLabel={t("countLabel", { count: total })}
      className={className}
    >
      {items.length === 0 ? (
        <div className="flex items-center gap-3 px-5 pb-5 text-sm text-muted-foreground">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
            <CalendarCheck aria-hidden="true" className="size-4" />
          </span>
          {t("empty")}
        </div>
      ) : (
        <ul className="divide-y border-t">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/quotes/${item.id}`}
                className="flex min-h-14 items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.customerName ?? tList("unknownCustomer")}
                  </p>
                  <p className="truncate text-xs tabular-nums text-muted-foreground">{item.number}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="money text-sm font-semibold text-foreground">{item.total}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none",
                      item.daysLeft <= 2 ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                    )}
                  >
                    <span className="sr-only">{t("daysLeftLabel", { days: item.daysLeft })}</span>
                    <span aria-hidden="true">{t("daysLeft", { days: item.daysLeft })}</span>
                  </span>
                </div>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
          {total > items.length ? (
            <li className="px-5 py-3 text-xs font-medium text-muted-foreground">
              {t("more", { count: total - items.length })}
            </li>
          ) : null}
        </ul>
      )}
    </SectionCard>
  );
}
