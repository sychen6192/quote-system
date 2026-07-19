import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, FileText, Plus } from "lucide-react";
import { Link } from "@/navigation";
import { getTranslations, getFormatter } from "next-intl/server";
import { formatCurrency } from "@/lib/utils";
import { getAppConfig } from "@/lib/config";
import { type QuoteListItem } from "@/services/quotes";
import { StatusBadge } from "./quote-status-badge";

export async function QuotesTable({ data }: { data: QuoteListItem[] }) {
  const t = await getTranslations("QuotesList");
  const format = await getFormatter();
  const { money } = getAppConfig();

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground hover:bg-muted/40">
              <TableHead className="w-[120px]">
                {t("table.quoteNumber")}
              </TableHead>
              <TableHead className="min-w-[150px]">
                {t("table.customer")}
              </TableHead>
              <TableHead className="hidden md:table-cell">
                {t("table.salesperson")}
              </TableHead>
              <TableHead className="hidden lg:table-cell">
                {t("table.date")}
              </TableHead>
              <TableHead className="hidden lg:table-cell">
                {t("table.validUntil")}
              </TableHead>
              <TableHead className="text-right">
                {t("table.totalAmount")}
              </TableHead>
              <TableHead className="text-right w-[100px]">
                {t("table.action")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="h-64">
                  <div className="flex flex-col items-center justify-center gap-3 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
                      <FileText className="h-6 w-6" />
                    </div>
                    <p className="text-muted-foreground">{t("emptyState")}</p>
                    <Link href="/quotes/new">
                      <Button variant="gradient" size="sm">
                        <Plus className="mr-2 h-4 w-4" /> {t("createQuote")}
                      </Button>
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((quote) => (
                <TableRow
                  key={quote.id}
                  className="group hover:bg-muted/50 transition-colors"
                >
                  <TableCell className="font-medium">
                    <Link
                      href={`/quotes/${quote.id}`}
                      className="block min-w-max font-semibold text-primary hover:underline"
                    >
                      {quote.quotationNumber}
                    </Link>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-grad-brand text-xs font-bold text-white">
                        {(
                          quote.customer?.companyName || t("unknownCustomer")
                        ).slice(0, 1)}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate max-w-[150px] font-medium md:max-w-none">
                          {quote.customer?.companyName || t("unknownCustomer")}
                        </div>
                        <div className="mt-0.5 block text-xs text-muted-foreground md:hidden">
                          {quote.issuedDate
                            ? format.dateTime(new Date(quote.issuedDate), {
                                dateStyle: "short",
                              })
                            : "-"}
                        </div>
                        <div className="hidden text-xs text-muted-foreground md:block">
                          {quote.customer?.contactPerson}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="hidden md:table-cell">
                    {quote.salesperson}
                  </TableCell>

                  <TableCell className="hidden lg:table-cell">
                    {quote.issuedDate
                      ? format.dateTime(new Date(quote.issuedDate), {
                          dateStyle: "medium",
                        })
                      : "-"}
                  </TableCell>

                  <TableCell className="hidden lg:table-cell">
                    <StatusBadge
                      status={quote.status}
                      validUntil={
                        quote.validUntil ? new Date(quote.validUntil) : null
                      }
                    />
                  </TableCell>

                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrency(quote.totalAmount, money)}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-1">
                      <Link href={`/quotes/${quote.id}/edit`}>
                        <Button variant="ghost" size="icon" title="Edit">
                          <Pencil className="h-4 w-4 text-muted-foreground hover:text-blue-600 transition-colors" />
                        </Button>
                      </Link>
                      <Link href={`/quotes/${quote.id}`}>
                        <Button variant="ghost" size="icon" title="View">
                          <Eye className="h-4 w-4 text-muted-foreground hover:text-black transition-colors" />
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
