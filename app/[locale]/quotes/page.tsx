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
import { ArrowLeft, Eye, Pencil } from "lucide-react"; // ✅ 新增 Pencil icon
import { getTranslations, getFormatter } from "next-intl/server"; // ✅ 新增 getFormatter
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function QuotesListPage() {
  // 1. 初始化翻譯與格式化工具
  const t = await getTranslations("QuotesList");
  const format = await getFormatter(); // 取得 Server 端的格式化工具

  // 2. 資料庫查詢
  const data = await db.query.quotations.findMany({
    with: {
      customer: true,
    },
    orderBy: [desc(quotations.createdAt)],
  });

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <Link href="/">
          <Button variant="outline">
            {" "}
            {/* 改用 outline 比較不搶眼 */}
            <ArrowLeft className="mr-2 h-4 w-4" /> {t("backToDashboard")}
          </Button>
        </Link>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.quoteNumber")}</TableHead>
              <TableHead>{t("table.customer")}</TableHead>
              <TableHead>{t("table.salesperson")}</TableHead>
              <TableHead>{t("table.date")}</TableHead>
              <TableHead>{t("table.validUntil")}</TableHead>
              <TableHead className="text-right">
                {t("table.totalAmount")}
              </TableHead>
              <TableHead className="text-right">{t("table.action")}</TableHead>
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
                    {/* 點擊單號通常是進去「看」詳細內容 */}
                    <Link
                      href={`/quotes/${quote.id}`}
                      className="hover:underline text-blue-600"
                    >
                      {quote.quotationNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {quote.customer?.companyName || t("unknownCustomer")}
                    </div>
                    <div className="text-xs text-muted-foreground hidden md:block">
                      {quote.customer?.contactPerson}
                    </div>
                  </TableCell>
                  <TableCell>{quote.salesperson}</TableCell>

                  {/* 使用 next-intl 格式化日期 */}
                  <TableCell>
                    {format.dateTime(new Date(quote.issuedDate), {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </TableCell>

                  <TableCell>
                    {new Date(quote.validUntil) < new Date() ? (
                      <Badge variant="destructive">{t("status.expired")}</Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-800 hover:bg-green-100"
                      >
                        {t("status.active")}
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-right font-mono font-medium">
                    {/* 使用 next-intl 格式化貨幣 (台幣不顯示小數點) */}
                    {formatCurrency(quote.totalAmount)}
                  </TableCell>

                  {/* --- Action Column 優化 --- */}
                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-1">
                      {/* 1. 編輯按鈕 (通常連到 /edit 路由) */}
                      <Link href={`/quotes/${quote.id}/edit`}>
                        <Button variant="ghost" size="icon" title="Edit">
                          <Pencil className="h-4 w-4 text-muted-foreground hover:text-blue-600 transition-colors" />
                        </Button>
                      </Link>

                      {/* 2. 檢視按鈕 */}
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
