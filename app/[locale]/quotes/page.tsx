import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getQuotesList } from "@/services/quotes";
import { QuotesTable } from "@/components/quotes/quotes-table";
import { PaginationControls } from "@/components/pagination-controls"; // 引入分頁元件

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function QuotesListPage({ searchParams }: PageProps) {
  const t = await getTranslations("QuotesList");

  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const pageSize = 10;

  const { data, metadata } = await getQuotesList(page, pageSize);

  return (
    <div className="container mx-auto py-4 md:py-10 px-4 md:px-0">
      {/* Header Section */}
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
              <Plus className="mr-2 h-4 w-4" /> {t("createQuote")}
            </Button>
          </Link>
        </div>
      </div>

      <QuotesTable data={data} key={page} />

      <PaginationControls
        currentPage={metadata.page}
        totalPages={metadata.totalPages}
        baseUrl="/quotes"
      />
    </div>
  );
}
