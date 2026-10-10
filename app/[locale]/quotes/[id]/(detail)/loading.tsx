import { useTranslations } from "next-intl";
import { PageContainer } from "@/components/app-shell/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function QuoteDetailLoading() {
  const t = useTranslations("Common");
  return (
    <PageContainer className="pb-28 md:pb-8">
      <div aria-busy="true" className="space-y-5 md:space-y-6">
        <span className="sr-only" role="status">
          {t("loading")}
        </span>
        <Skeleton className="h-5 w-24" />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-52" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-5 w-64 max-w-full" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="h-14 w-full rounded-xl md:h-12 md:w-40" />
        </div>
        <div className="hidden gap-2 md:flex">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-20" />
          <Skeleton className="size-9" />
        </div>
        <div className="grid gap-5 md:gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="overflow-hidden rounded-xl border bg-ground">
            <div className="flex justify-end border-b bg-card/60 px-3 py-2">
              <Skeleton className="h-8 w-32" />
            </div>
            <div className="p-3 sm:p-5 lg:p-8">
              <div className="mx-auto aspect-[210/297] max-w-[210mm] bg-paper p-[7%] shadow-elevated">
                <div className="flex justify-between">
                  <Skeleton className="h-6 w-1/3 bg-slate-200 sm:h-10" />
                  <Skeleton className="h-6 w-1/5 bg-slate-200 sm:h-10" />
                </div>
                <div className="mt-[8%] grid grid-cols-2 gap-[6%]">
                  <Skeleton className="aspect-[3/1] bg-slate-100" />
                  <Skeleton className="aspect-[3/1] bg-slate-100" />
                </div>
                <div className="mt-[8%] space-y-[3%]">
                  {Array.from({ length: 6 }, (_, i) => (
                    <Skeleton key={i} className="h-3 bg-slate-100 sm:h-4" />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-3 rounded-xl border bg-card p-4 shadow-card sm:p-5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Same footprint as the phone action bar, so nothing jumps when it arrives. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pb-safe-3 pt-3 md:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          <Skeleton className="h-12 flex-1 rounded-md" />
          <Skeleton className="h-12 flex-1 rounded-md" />
          <Skeleton className="size-12 rounded-md" />
        </div>
      </div>
    </PageContainer>
  );
}
