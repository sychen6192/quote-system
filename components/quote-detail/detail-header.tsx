"use client";

import { AlertTriangle, ArrowLeft, Building2, CalendarDays, Copy, Hourglass } from "lucide-react";
import { useTranslations } from "next-intl";
import { StatusBadge } from "@/components/quotes/quote-status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "@/navigation";
import { useQuoteDetail } from "./detail-context";
import { validityOf } from "./model";
import { QuoteToolbar } from "./quote-actions";

export type DetailHeaderProps = {
  /** formatted with the configured currency */
  total: string;
  issuedDateLabel: string;
  validUntilLabel: string;
};

export function DetailHeader({ total, issuedDateLabel, validUntilLabel }: DetailHeaderProps) {
  const t = useTranslations("QuoteDetail");
  const { quote, displayStatus } = useQuoteDetail();
  const validity = validityOf(quote.validUntil, quote.today, displayStatus);

  return (
    <header className="space-y-4 print:hidden">
      <Link
        href="/quotes"
        aria-label={t("backLabel")}
        className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:min-h-9"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("back")}
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground [overflow-wrap:anywhere] md:text-[1.75rem] md:leading-9">
              {quote.quotationNumber}
            </h1>
            <StatusBadge status={displayStatus} size="md" />
          </div>
          {quote.title ? (
            <p className="text-base font-medium text-foreground/90 md:text-lg">{quote.title}</p>
          ) : null}
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
            {quote.customerName ? (
              <li className="flex min-w-0 items-center gap-1.5">
                <Building2 aria-hidden="true" className="size-4 shrink-0" />
                <span className="sr-only">{t("customer.title")}: </span>
                <span className="truncate font-medium text-foreground">{quote.customerName}</span>
              </li>
            ) : null}
            <li className="flex items-center gap-1.5">
              <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
              <span className="tabular-nums">{t("issued", { date: issuedDateLabel })}</span>
            </li>
            <li
              className={cn(
                "flex items-center gap-1.5",
                validity.kind === "expired" && "font-medium text-destructive",
                validity.kind === "soon" && "font-medium text-warning"
              )}
            >
              <Hourglass aria-hidden="true" className="size-4 shrink-0" />
              <span className="tabular-nums">
                {t("validUntil", { date: validUntilLabel })}
                {validity.kind === "expired" ? <> · {t("expiredAgo", { days: validity.days })}</> : null}
                {validity.kind === "soon" ? <> · {t("daysLeft", { days: validity.days })}</> : null}
              </span>
            </li>
          </ul>
        </div>

        <div className="flex items-baseline justify-between gap-4 rounded-xl border bg-card px-4 py-3 shadow-card md:block md:border-0 md:bg-transparent md:p-0 md:text-right md:shadow-none">
          <p className="text-sm font-medium text-muted-foreground">{t("total")}</p>
          <p className="money text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{total}</p>
        </div>
      </div>

      <QuoteToolbar className="hidden md:flex" />
    </header>
  );
}

/** Shown while the quote is open but past its valid-until date. */
export function ExpiredNotice({ validUntilLabel }: { validUntilLabel: string }) {
  const t = useTranslations("QuoteDetail.expiredBanner");
  const { quote, displayStatus } = useQuoteDetail();
  if (displayStatus !== "expired") return null;

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between print:hidden"
    >
      <div className="flex gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
        <div className="space-y-0.5">
          <p className="font-semibold text-foreground">{t("title", { date: validUntilLabel })}</p>
          {/* Not muted-foreground: that is 4.1:1 on the warning tint. */}
          <p className="text-sm text-foreground/80">{t("description")}</p>
        </div>
      </div>
      <Button asChild variant="outline" className="h-11 shrink-0 bg-background md:h-9">
        <Link href={{ pathname: "/quotes/new", query: { from: String(quote.id) } }}>
          <Copy aria-hidden="true" />
          {t("duplicate")}
        </Link>
      </Button>
    </div>
  );
}
