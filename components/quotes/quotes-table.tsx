import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "./quote-status-badge";
import { QuoteRowActions } from "./quote-row-actions";
import { ValidUntil } from "./valid-until";
import type { QuoteRowView } from "./quote-row";

/** Desktop (md+) quotes table; each row opens its quote, ⋯ holds the actions. */
export function QuotesTable({ rows }: { rows: QuoteRowView[] }) {
  const t = useTranslations("QuotesList");

  return (
    <div className="hidden overflow-hidden rounded-xl border bg-card shadow-card md:block">
      <Table>
        <TableCaption className="sr-only">{t("table.caption")}</TableCaption>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="h-11 pl-5 text-xs font-medium">{t("table.number")}</TableHead>
            <TableHead className="h-11 text-xs font-medium">{t("table.quote")}</TableHead>
            <TableHead className="hidden h-11 text-xs font-medium xl:table-cell">
              {t("table.salesperson")}
            </TableHead>
            <TableHead className="hidden h-11 text-xs font-medium lg:table-cell">
              {t("table.issued")}
            </TableHead>
            <TableHead className="h-11 text-xs font-medium">{t("table.validUntil")}</TableHead>
            <TableHead className="h-11 text-xs font-medium">{t("table.status")}</TableHead>
            <TableHead className="h-11 text-right text-xs font-medium">{t("table.total")}</TableHead>
            <TableHead className="h-11 w-12 pr-3 text-right text-xs font-medium">
              <span className="sr-only">{t("table.actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const primary = row.title ?? row.customerName ?? t("unknownCustomer");
            const secondary = row.title ? row.customerName : row.contactPerson;
            return (
              <TableRow key={row.id} className="group relative hover:bg-muted/40 has-[a:focus-visible]:bg-muted/60">
                <TableCell className="py-3 pl-5">
                  {/* The ::after overlay makes the whole row open the quote. */}
                  <Link
                    href={`/quotes/${row.id}`}
                    aria-label={t("openQuote", { number: row.number })}
                    className="whitespace-nowrap font-medium tabular-nums text-foreground after:absolute after:inset-0 after:content-[''] group-hover:text-primary"
                  >
                    {row.number}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[22rem] py-3">
                  <div className="truncate font-medium text-foreground">{primary}</div>
                  {secondary ? (
                    <div className="truncate text-xs text-muted-foreground">{secondary}</div>
                  ) : null}
                </TableCell>
                <TableCell className="hidden max-w-[10rem] truncate py-3 text-muted-foreground xl:table-cell">
                  {row.salesperson}
                </TableCell>
                <TableCell className="hidden whitespace-nowrap py-3 tabular-nums text-muted-foreground lg:table-cell">
                  {row.issuedLabel}
                </TableCell>
                <TableCell className="py-3">
                  <ValidUntil row={row} />
                </TableCell>
                <TableCell className="py-3">
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell className="money py-3 text-right font-semibold text-foreground">
                  {row.total}
                </TableCell>
                <TableCell className="relative z-10 py-2 pr-3 text-right">
                  <QuoteRowActions id={row.id} quotationNumber={row.number} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
