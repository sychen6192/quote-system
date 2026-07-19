import { formatCurrency } from "@/lib/utils";
import { getAppConfig } from "@/lib/config";
import { DollarSign, FileText, Plus, Users } from "lucide-react";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import { getTranslations } from "next-intl/server";
import { getDashboardMetrics, getRecentQuotes } from "@/services/dashboard";
import { StatCard } from "@/components/dashboard/stat-card";
import { RecentQuotesTable } from "@/components/dashboard/recent-quotes-table";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");
  const { money } = getAppConfig();
  const [metrics, recentQuotes] = await Promise.all([
    getDashboardMetrics(),
    getRecentQuotes(),
  ]);

  return (
    <div className="container mx-auto py-4 md:py-10 space-y-8 px-4 md:px-0">
      {/* Header Section */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>

        <Link href="/quotes/new">
          <Button variant="gradient">
            <Plus className="mr-2 h-4 w-4" /> {t("createQuote")}
          </Button>
        </Link>
      </header>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title={t("totalRevenue")}
          value={formatCurrency(metrics.totalRevenue, money)}
          description="All time revenue"
          icon={DollarSign}
        />
        <StatCard
          title={t("totalQuotes")}
          value={metrics.totalQuotes}
          description="Issued in total"
          icon={FileText}
        />
        <StatCard
          title={t("customers")}
          value={metrics.totalCustomers}
          description="Active clients"
          icon={Users}
        />
      </div>
      <RecentQuotesTable data={recentQuotes} />
    </div>
  );
}
