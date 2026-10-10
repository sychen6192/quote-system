import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import { mergeQuery, withQuery, type QueryValue } from "@/components/app-shell/query";
import { cn } from "@/lib/utils";

interface PaginationControlsProps {
  /** Already clamped to [1, totalPages] by the service. */
  currentPage: number;
  totalPages: number;
  /** Locale-less path, e.g. "/quotes". */
  baseUrl: string;
  /** Filters to keep in the page links (q, status, sort…). */
  query?: Record<string, QueryValue>;
  /** Shows "21–40 of 57" when both are given. */
  total?: number;
  pageSize?: number;
  className?: string;
}

export function PaginationControls({
  currentPage,
  totalPages,
  baseUrl,
  query = {},
  total,
  pageSize,
  className,
}: PaginationControlsProps) {
  const t = useTranslations("Common.pagination");

  if (totalPages <= 1) return null;

  const page = Math.min(Math.max(1, currentPage), totalPages);
  const href = (target: number) => withQuery(baseUrl, mergeQuery(query, { page: target }));
  const range =
    total !== undefined && pageSize
      ? t("range", {
          from: (page - 1) * pageSize + 1,
          to: Math.min(page * pageSize, total),
          total,
        })
      : null;

  const button = "h-11 flex-1 rounded-lg bg-card shadow-card sm:h-9 sm:flex-none";

  return (
    <nav
      aria-label={t("label")}
      className={cn("flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-between", className)}
    >
      <p className="order-2 text-sm tabular-nums text-muted-foreground sm:order-1">
        {range ?? t("pageInfo", { current: page, total: totalPages })}
      </p>
      <div className="order-1 flex w-full items-center gap-2 sm:order-2 sm:w-auto">
        {page <= 1 ? (
          <Button variant="outline" disabled className={button}>
            <ChevronLeft aria-hidden="true" />
            {t("previous")}
          </Button>
        ) : (
          <Button variant="outline" asChild className={button}>
            <Link href={href(page - 1)} rel="prev">
              <ChevronLeft aria-hidden="true" />
              {t("previous")}
            </Link>
          </Button>
        )}
        {range ? (
          <span className="hidden px-2 text-sm tabular-nums text-muted-foreground sm:inline">
            {t("pageInfo", { current: page, total: totalPages })}
          </span>
        ) : null}
        {page >= totalPages ? (
          <Button variant="outline" disabled className={button}>
            {t("next")}
            <ChevronRight aria-hidden="true" />
          </Button>
        ) : (
          <Button variant="outline" asChild className={button}>
            <Link href={href(page + 1)} rel="next">
              {t("next")}
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        )}
      </div>
    </nav>
  );
}
