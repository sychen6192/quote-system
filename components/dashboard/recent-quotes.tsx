import { ArrowRight, ChevronRight, History } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/quotes/quote-status-badge";
import type { QuoteRowView } from "@/components/quotes/quote-row";
import { SectionCard } from "./section-card";

/** The newest quotes: a table on md+, compact tappable rows on phones. */
export function RecentQuotes({ rows, className }: { rows: QuoteRowView[]; className?: string }) {
  const t = useTranslations("Dashboard.recent");
  const tList = useTranslations("QuotesList");

  return (
    <SectionCard
      icon={History}
      title={t("title")}
      className={className}
      action={
        <Button asChild variant="ghost" size="sm" className="-mr-2 h-9 text-primary hover:text-primary">
          <Link href="/quotes">
            {t("viewAll")}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      {/* Phones */}
      <ul className="divide-y border-t md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={`/quotes/${row.id}`}
              className="flex min-h-16 items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50 active:bg-muted"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {row.customerName ?? tList("unknownCustomer")}
                </p>
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs tabular-nums text-muted-foreground">{row.number}</span>
                  <StatusBadge status={row.status} />
                </div>
              </div>
              <span className="money shrink-0 text-sm font-semibold text-foreground">{row.total}</span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>

      {/* md+ */}
      <div className="hidden border-t md:block">
        <Table>
          <TableCaption className="sr-only">{t("title")}</TableCaption>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="h-10 pl-5 text-xs font-medium">{tList("table.number")}</TableHead>
              <TableHead className="h-10 text-xs font-medium">{tList("table.quote")}</TableHead>
              <TableHead className="hidden h-10 text-xs font-medium xl:table-cell">{t("issued")}</TableHead>
              <TableHead className="h-10 text-xs font-medium">{tList("table.status")}</TableHead>
              <TableHead className="h-10 pr-5 text-right text-xs font-medium">{t("total")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="group relative hover:bg-muted/40 has-[a:focus-visible]:bg-muted/60">
                <TableCell className="py-3 pl-5">
                  <Link
                    href={`/quotes/${row.id}`}
                    aria-label={tList("openQuote", { number: row.number })}
                    title={row.number}
                    className="inline-block max-w-[9rem] truncate align-middle font-medium tabular-nums xl:max-w-[12rem] text-foreground after:absolute after:inset-0 after:content-[''] group-hover:text-primary"
                  >
                    {row.number}
                  </Link>
                </TableCell>
                <TableCell className="w-full max-w-0 py-3">
                  <p title={row.title ?? row.customerName ?? undefined} className="truncate font-medium text-foreground">
                    {row.title ?? row.customerName ?? tList("unknownCustomer")}
                  </p>
                  {row.title && row.customerName ? (
                    <p title={row.customerName} className="truncate text-xs text-muted-foreground">
                      {row.customerName}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="hidden whitespace-nowrap py-3 tabular-nums text-muted-foreground xl:table-cell">
                  {row.issuedLabel}
                </TableCell>
                <TableCell className="py-3">
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell className="money whitespace-nowrap py-3 pr-5 text-right font-semibold text-foreground">
                  {row.total}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}
