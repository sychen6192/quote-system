import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { Link } from "@/navigation";
import { getTranslations } from "next-intl/server";
import { formatCurrency } from "@/lib/utils";

// 定義資料型別 (建議從 schema 或 Drizzle 推導出的 type import)
type QuoteData = {
  id: string;
  quotationNumber: string;
  totalAmount: number;
  status: string | null;
  issuedDate: Date | string | null;
  customer: { companyName: string } | null;
};

export async function RecentQuotesTable({ data }: { data: QuoteData[] }) {
  const t = await getTranslations("Dashboard");
  const tCommon = await getTranslations("Common");

  return (
    <Card className="col-span-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("recentQuotes")}</CardTitle>
        <Link
          href="/quotes"
          className="text-sm text-blue-600 hover:underline flex items-center"
        >
          {t("viewAll")} <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent className="p-0 md:p-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tCommon("number")}</TableHead>
                <TableHead>{tCommon("customer")}</TableHead>
                <TableHead>{tCommon("date")}</TableHead>
                <TableHead>{tCommon("status")}</TableHead>
                <TableHead className="text-right">
                  {tCommon("amount")}
                </TableHead>
                {/* 增加一個隱形的 Action 欄位來處理點擊 */}
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((q) => (
                // group: 用於 hover 效果
                // relative: 讓內部的 Link 可以用 absolute 撐滿整行
                <TableRow
                  key={q.id}
                  className="group relative hover:bg-muted/50"
                >
                  <TableCell className="font-medium">
                    {q.quotationNumber}
                  </TableCell>
                  <TableCell>{q.customer?.companyName || "Unknown"}</TableCell>
                  <TableCell>
                    {q.issuedDate
                      ? new Date(q.issuedDate).toLocaleDateString("zh-TW")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {t(`status.${q.status || "draft"}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatCurrency(q.totalAmount)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/quotes/${q.id}`}
                      className="absolute inset-0 z-10"
                      aria-label={`View quote ${q.quotationNumber}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
