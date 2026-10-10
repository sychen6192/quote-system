import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/app-shell/page-header";

export default function DashboardLoading() {
  const t = useTranslations("Common");
  return (
    <PageContainer>
      <div aria-busy="true" className="space-y-6">
        <span className="sr-only" role="status">
          {t("loading")}
        </span>
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <Skeleton className="hidden h-9 w-32 rounded-lg sm:block" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 shadow-card md:p-5">
              <div className="flex items-start justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="size-8 rounded-lg" />
              </div>
              <Skeleton className="mt-3 h-7 w-3/4" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <div className="order-2 overflow-hidden rounded-xl border bg-card shadow-card lg:order-1">
            <div className="flex items-center justify-between px-5 pb-3 pt-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16" />
            </div>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 border-t px-5 py-3.5">
                <Skeleton className="hidden h-4 w-32 md:block" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
          <div className="order-1 overflow-hidden rounded-xl border bg-card shadow-card lg:order-2">
            <div className="space-y-2 px-5 pb-3 pt-4">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-52 max-w-full" />
            </div>
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 border-t px-5 py-3">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="ml-auto h-4 w-10 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
