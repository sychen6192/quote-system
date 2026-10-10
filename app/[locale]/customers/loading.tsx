import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/app-shell/page-header";

export default function CustomersLoading() {
  const t = useTranslations("Common");
  return (
    <PageContainer>
      <div aria-busy="true" className="space-y-5 md:space-y-6">
        <span className="sr-only" role="status">
          {t("loading")}
        </span>
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="hidden h-9 w-32 rounded-lg sm:block" />
        </div>
        <Skeleton className="h-11 max-w-xl rounded-lg md:h-10" />
        <div className="hidden overflow-hidden rounded-xl border bg-card shadow-card lg:block">
          <div className="h-11 border-b bg-muted/50" />
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex items-center gap-6 border-b px-5 py-4 last:border-0">
              <div className="flex flex-1 items-center gap-3">
                <Skeleton className="size-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="hidden h-4 w-24 xl:block" />
              <Skeleton className="h-8 w-28 rounded-lg" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:hidden">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 shadow-card">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <div className="mb-3 mt-2">
                {["w-1/3", "w-3/5", "w-2/5"].map((w) => (
                  <div key={w} className="flex h-11 items-center">
                    <Skeleton className={`h-4 ${w}`} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-[3rem_minmax(0,1fr)_5.5rem] gap-x-5 border-t pt-3">
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Skeleton className="h-11 rounded-lg" />
                <Skeleton className="h-11 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
