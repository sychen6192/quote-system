import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/app-shell/page-header";

export default function SettingsLoading() {
  const t = useTranslations("Common");
  return (
    <PageContainer>
      <div aria-busy="true">
        <span className="sr-only" role="status">
          {t("loading")}
        </span>
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="mt-4 lg:mt-8 lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:items-start lg:gap-10 xl:gap-12">
          <div className="-mx-4 flex gap-1 overflow-hidden border-b px-4 py-2 md:-mx-6 md:px-6 lg:mx-0 lg:flex-col lg:border-0 lg:p-0">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-28 shrink-0 rounded-full lg:h-10 lg:w-full lg:rounded-lg" />
            ))}
          </div>
          <div className="max-w-4xl space-y-5 pt-5 lg:pt-0">
            <div className="flex items-start gap-3">
              <Skeleton className="hidden size-10 rounded-xl sm:block" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-72 max-w-full" />
              </div>
            </div>
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="rounded-xl border bg-card p-4 shadow-card md:p-6">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="mt-2 h-4 w-64 max-w-full" />
                <div className="mt-6 grid gap-x-4 gap-y-5 sm:grid-cols-2">
                  {Array.from({ length: 7 }, (_, i) => (
                    <div key={i} className={i === 2 ? "space-y-2 sm:col-span-2" : "space-y-2"}>
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className={i === 2 ? "h-[4.5rem] w-full" : "h-11 w-full md:h-9"} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4 shadow-card">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-3 h-40 w-full rounded-lg" />
                <Skeleton className="mt-3 h-3 w-3/4" />
              </div>
            </div>
            <Skeleton className="h-[3.75rem] w-full rounded-xl" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
