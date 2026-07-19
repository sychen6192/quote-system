import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
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
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      {/* Header Section */}
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {t("title")}
        </h1>
        <Link href="/quotes/new" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> {t("createQuote")}
          </Button>
        </Link>
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
