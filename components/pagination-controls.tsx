import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
}

export function PaginationControls({
  currentPage,
  totalPages,
  baseUrl,
}: PaginationControlsProps) {
  const t = useTranslations("Common.pagination");

  if (totalPages <= 1) return null;

  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  return (
    <div className="flex items-center justify-end gap-3 py-4">
      <div className="text-sm text-muted-foreground">
        {t("pageInfo", { current: currentPage, total: totalPages })}
      </div>

      <div className="flex items-center gap-2">
        {isFirstPage ? (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="h-4 w-4 mr-1" />
            {t("previous")}
          </Button>
        ) : (
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`${baseUrl}?page=${currentPage - 1}`}
              className="flex items-center"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              <span className="whitespace-nowrap">{t("previous")}</span>
            </Link>
          </Button>
        )}

        {isLastPage ? (
          <Button variant="outline" size="sm" disabled>
            {t("next")}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`${baseUrl}?page=${currentPage + 1}`}
              className="flex items-center"
            >
              <span className="whitespace-nowrap">{t("next")}</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
