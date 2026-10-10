import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/app-shell/page-header";

// Scoped to the list via the (list) route group: a loading boundary above
// quotes/[id] would stream its notFound() with HTTP 200.
export default function QuotesListLoading() {
  const t = useTranslations("Common");
  return (
    <PageContainer>
      <div aria-busy="true" className="space-y-5 md:space-y-6">
        <span className="sr-only" role="status">
          {t("loading")}
        </span>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-11 flex-1 rounded-lg sm:h-9 sm:w-32 sm:flex-none" />
            <Skeleton className="hidden h-9 w-32 rounded-lg sm:block" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-11 flex-1 rounded-lg md:h-10" />
            <Skeleton className="h-11 w-11 rounded-lg sm:w-48 md:h-10" />
          </div>
          <div className="flex gap-2 overflow-hidden">
            {[64, 80, 72, 88, 84, 76].map((w, i) => (
              <Skeleton key={i} className="h-10 shrink-0 rounded-full md:h-9" style={{ width: w }} />
            ))}
          </div>
        </div>
        {/* Desktop table */}
        <div className="hidden overflow-hidden rounded-xl border bg-card shadow-card md:block">
          <div className="h-11 border-b bg-muted/50" />
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-6 border-b px-5 py-4 last:border-0">
              <Skeleton className="h-4 w-32" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="hidden h-4 w-24 lg:block" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          ))}
        </div>
        {/* Phone cards */}
        <div className="space-y-3 md:hidden">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 shadow-card">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="mt-2 h-5 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/2" />
              <div className="mt-3 flex justify-between border-t pt-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
