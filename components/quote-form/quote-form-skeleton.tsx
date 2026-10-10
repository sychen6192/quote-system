import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

function FieldSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className={wide ? "space-y-2 md:col-span-2" : "space-y-2"}>
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="h-11 w-full md:h-9" />
    </div>
  );
}

function SectionSkeleton({ fields }: { fields: boolean[] }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card md:p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="hidden h-3 w-44 sm:block" />
        </div>
      </div>
      <div className="mt-6 grid gap-x-4 gap-y-5 md:grid-cols-2">
        {fields.map((wide, index) => (
          <FieldSkeleton key={index} wide={wide} />
        ))}
      </div>
    </div>
  );
}

/** Route-level loading state with the editor's layout, so nothing jumps. */
export function QuoteFormSkeleton() {
  const t = useTranslations("QuoteForm");
  return (
    <div
      aria-busy="true"
      className="mx-auto w-full max-w-[1680px] px-4 pb-28 pt-4 md:px-6 md:pb-0 md:pt-6 xl:px-8"
    >
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
      <Skeleton className="my-2 h-4 w-20" />
      <Skeleton className="mt-2 h-8 w-56 md:h-9" />
      <Skeleton className="mt-2 h-4 w-full max-w-md" />
      <div className="mt-5 grid gap-6 md:mt-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,40%)] xl:gap-8">
        <div className="min-w-0 space-y-4 md:space-y-5">
          <Skeleton className="hidden h-11 w-full rounded-xl md:block" />
          <SectionSkeleton fields={[true, false, false, false, false, true]} />
          <SectionSkeleton fields={[true, false, false, false]} />
          <SectionSkeleton fields={[true, false, false]} />
        </div>
        <div className="sticky top-[4.25rem] hidden h-[calc(100dvh-10.75rem)] flex-col overflow-hidden rounded-xl border bg-ground shadow-card xl:flex">
          <div className="flex h-12 items-center gap-2 border-b bg-card px-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-8 w-28" />
          </div>
          <div className="p-6">
            <div className="mx-auto aspect-[210/297] w-full max-w-[210mm] rounded-sm bg-paper shadow-elevated ring-1 ring-black/5" />
          </div>
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t bg-background/95 px-4 pt-3 pb-safe-3 md:sticky md:-mx-6 md:mt-6 md:px-6 md:py-3 xl:-mx-8 xl:px-8">
        <div className="flex-1 space-y-1.5 md:flex md:items-center md:space-y-0">
          <Skeleton className="h-3 w-10 md:h-8 md:w-16" />
          <Skeleton className="h-5 w-24 md:hidden" />
        </div>
        <Skeleton className="h-11 w-24 md:h-9 md:w-28" />
        <Skeleton className="h-11 w-24 bg-primary/30 md:h-9 md:w-36" />
      </div>
    </div>
  );
}
