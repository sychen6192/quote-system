import { db } from "@/db";
import { quotations, customers } from "@/db/schema";
import { sql, desc } from "drizzle-orm";
import { formatCurrency } from "@/lib/utils";
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
import { ArrowRight, DollarSign, FileText, Plus, Users } from "lucide-react";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import { getTranslations } from "next-intl/server";
import LanguageSwitcher from "@/components/language-switcher";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");
  const tCommon = await getTranslations("Common");

  const [
    totalRevenueResult,
    totalQuotesResult,
    totalCustomersResult,
    recentQuotes,
  ] = await Promise.all([
    db
      .select({ value: sql<number>`sum(${quotations.totalAmount})` })
      .from(quotations),
    db.select({ count: sql<number>`count(*)` }).from(quotations),
    db
      .select({
        count: sql<number>`count(distinct ${customers.companyName})`.mapWith(
          Number
        ),
      })
      .from(customers),
    db.query.quotations.findMany({
      with: { customer: true },
      orderBy: [desc(quotations.createdAt)],
      limit: 5,
    }),
  ]);

  const totalRevenue = totalRevenueResult[0].value || 0;
  const totalQuotes = totalQuotesResult[0].count || 0;
  const totalCustomers = totalCustomersResult[0].count || 0;

  return (
    <div className="container mx-auto py-4 md:py-10 space-y-8 px-4 md:px-0">
      {" "}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="flex items-center gap-4">
          <LanguageSwitcher />

          <Link href="/quotes/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> {t("createQuote")}
            </Button>
          </Link>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("totalRevenue")}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">All time revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("totalQuotes")}
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalQuotes}</div>
            <p className="text-xs text-muted-foreground">Issued in total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("customers")}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
            <p className="text-xs text-muted-foreground">Active clients</p>
          </CardContent>
        </Card>
      </div>
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
                  <TableHead> {tCommon("number")}</TableHead>
                  <TableHead> {tCommon("customer")}</TableHead>
                  <TableHead>{tCommon("date")}</TableHead>
                  <TableHead>{tCommon("status")}</TableHead>
                  <TableHead className="text-right">
                    {tCommon("amount")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentQuotes.map((q) => (
                  <TableRow
                    key={q.id}
                    className="group cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="font-medium">
                      <Link
                        href={`/quotes/${q.id}`}
                        className="block w-full h-full"
                      >
                        {q.quotationNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/quotes/${q.id}`}
                        className="block w-full h-full"
                      >
                        {q.customer?.companyName || "Unknown"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/quotes/${q.id}`}
                        className="block w-full h-full text-muted-foreground"
                      >
                        {q.issuedDate
                          ? new Date(q.issuedDate).toLocaleDateString("zh-TW")
                          : "-"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/quotes/${q.id}`}
                        className="block w-full h-full"
                      >
                        <Badge variant="outline">
                          {t(`status.${q.status || "draft"}`)}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      <Link
                        href={`/quotes/${q.id}`}
                        className="block w-full h-full"
                      >
                        {formatCurrency(q.totalAmount)}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
