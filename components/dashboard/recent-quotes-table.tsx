import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight } from "lucide-react";
import { Link } from "@/navigation";
import { getTranslations } from "next-intl/server";
import { formatCurrency } from "@/lib/utils";
import { getAppConfig } from "@/lib/config";
import { StatusBadge } from "@/components/quotes/quote-status-badge";
import {
  QuoteCards,
  type QuoteCardItem,
} from "@/components/quotes/quote-cards";

// 定義資料型別 (建議從 schema 或 Drizzle 推導出的 type import)
type QuoteData = {
  id: number;
  quotationNumber: string;
  totalAmount: number;
  status: string | null;
  issuedDate: Date | string | null;
  customer: { companyName: string } | null;
};

export async function RecentQuotesTable({ data }: { data: QuoteData[] }) {
  const t = await getTranslations("Dashboard");
  const tCommon = await getTranslations("Common");
  const { money } = getAppConfig();

  const cardItems: QuoteCardItem[] = data.map((q) => ({
    id: q.id,
    quotationNumber: q.quotationNumber,
    customerName: q.customer?.companyName || "Unknown",
    dateLabel: q.issuedDate
      ? new Date(q.issuedDate).toLocaleDateString("zh-TW")
      : "-",
    amountLabel: formatCurrency(q.totalAmount, money),
    status: q.status,
  }));

  return (
    <Card className="col-span-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("recentQuotes")}</CardTitle>
        <Link
          href="/quotes"
          className="flex items-center text-sm text-primary hover:underline"
        >
          {t("viewAll")} <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent className="p-0 md:p-6">
        <QuoteCards items={cardItems} />
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
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
                    <StatusBadge status={q.status} />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(q.totalAmount, money)}
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
