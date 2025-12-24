import { db } from "@/db";
import { quotations } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Eye, Pencil, Plus } from "lucide-react";
import { getTranslations, getFormatter } from "next-intl/server";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function QuotesListPage() {
  const t = await getTranslations("QuotesList");
  const format = await getFormatter();

  const data = await db.query.quotations.findMany({
    with: { customer: true },
    orderBy: [desc(quotations.createdAt)],
  });

  return (
    // ✅ 1. 間距優化：手機 py-4 / 電腦 py-10
    <div className="container mx-auto py-4 md:py-10 px-4 md:px-0">
      {/* ✅ 2. Header 手機版垂直排列 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">{t("title")}</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <Link href="/" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto">
              <ArrowLeft className="mr-2 h-4 w-4" /> {t("backToDashboard")}
            </Button>
          </Link>
          <Link href="/quotes/new" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Create
            </Button>
          </Link>
        </div>
      </div>

      <div className="border rounded-md overflow-hidden">
        {/* ✅ 3. 表格加上橫向捲軸 (防止手機破版) */}
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
                {/* ✅ 4. 手機隱藏次要欄位 */}
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
                  <TableRow key={quote.id} className="group">
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
                      {/* 手機版把聯絡人也秀出來，因為可能隱藏了其他欄位 */}
                      <div className="text-xs text-muted-foreground md:hidden block">
                        {format.dateTime(new Date(quote.issuedDate), {
                          dateStyle: "short",
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground hidden md:block">
                        {quote.customer?.contactPerson}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {quote.salesperson}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {format.dateTime(new Date(quote.issuedDate), {
                        dateStyle: "medium",
                      })}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {new Date(quote.validUntil) < new Date() ? (
                        <Badge
                          variant="destructive"
                          className="whitespace-nowrap"
                        >
                          {t("status.expired")}
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-800 hover:bg-green-100 whitespace-nowrap"
                        >
                          {t("status.active")}
                        </Badge>
                      )}
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
    </div>
  );
}
