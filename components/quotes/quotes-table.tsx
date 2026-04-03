import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, Pencil } from "lucide-react";
import { Link } from "@/navigation";
import { getTranslations, getFormatter } from "next-intl/server";
import { formatCurrency } from "@/lib/utils";
import { type QuoteListItem } from "@/services/quotes";
import { QuoteStatusBadge } from "./quote-status-badge";

export async function QuotesTable({ data }: { data: QuoteListItem[] }) {
  const t = await getTranslations("QuotesList");
  const format = await getFormatter();

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
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
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center h-24 text-muted-foreground"
                >
                  {t("emptyState")}
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
                      className="hover:underline text-blue-600 block min-w-max"
                    >
                      {quote.quotationNumber}
                    </Link>
                  </TableCell>

                  <TableCell>
                    <div className="font-medium truncate max-w-[150px] md:max-w-none">
                      {quote.customer?.companyName || t("unknownCustomer")}
                    </div>
                    <div className="text-xs text-muted-foreground md:hidden block mt-1">
                      {quote.issuedDate
                        ? format.dateTime(new Date(quote.issuedDate), {
                            dateStyle: "short",
                          })
                        : "-"}
                    </div>
                    <div className="text-xs text-muted-foreground hidden md:block">
                      {quote.customer?.contactPerson}
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
                    <QuoteStatusBadge
                      validUntil={
                        quote.validUntil ? new Date(quote.validUntil) : null
                      }
                    />
                  </TableCell>

                  <TableCell className="text-right font-mono font-medium">
                    {formatCurrency(quote.totalAmount)}
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
