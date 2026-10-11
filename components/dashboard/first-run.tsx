import { Check, FilePlus2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const POINTS = ["pdf", "email", "track"] as const;

/** Empty dashboard: a welcome card with one big call to action. */
export function FirstRunHero({
  showCompanyLink,
  className,
}: {
  showCompanyLink: boolean;
  className?: string;
}) {
  const t = useTranslations("Onboarding.firstRun");

  return (
    <section
      aria-labelledby="first-run-title"
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card p-6 shadow-card sm:p-8 lg:p-10",
        className
      )}
    >
      {/* Decorative quote sheet, echoing the document the user is about to make. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-10 top-1/2 hidden -translate-y-1/2 xl:block"
      >
        <div className="relative h-64 w-52">
          <div className="absolute inset-0 rotate-6 rounded-2xl bg-primary/10" />
          <div className="absolute inset-0 -rotate-3 rounded-2xl border bg-background" />
          <div className="absolute inset-0 flex flex-col gap-2.5 rounded-2xl border bg-paper p-5 shadow-elevated">
            <div className="flex items-center justify-between">
              <div className="size-7 rounded-lg bg-primary" />
              <div className="h-2 w-16 rounded-full bg-slate-200" />
            </div>
            <div className="mt-2 h-2.5 w-2/3 rounded-full bg-slate-300" />
            <div className="h-2 w-1/2 rounded-full bg-slate-200" />
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
              {[80, 64, 72].map((w) => (
                <div key={w} className="flex items-center justify-between gap-3">
                  <div className="h-2 rounded-full bg-slate-200" style={{ width: `${w}%` }} />
                  <div className="h-2 w-8 rounded-full bg-slate-200" />
                </div>
              ))}
            </div>
            <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
              <div className="h-2 w-10 rounded-full bg-slate-300" />
              <div className="h-3 w-16 rounded-full bg-primary/70" />
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-xl xl:max-w-[30rem] 2xl:max-w-xl">
        <span
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-elevated"
        >
          <FilePlus2 className="size-7" strokeWidth={1.75} />
        </span>
        <p className="mt-6 text-sm font-semibold text-primary">{t("eyebrow")}</p>
        <h2 id="first-run-title" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("title")}
        </h2>
        <ul className="mt-5 space-y-2">
          {POINTS.map((point) => (
            <li key={point} className="flex items-center gap-2.5 text-sm text-foreground">
              <span
                aria-hidden="true"
                className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success/10 text-success"
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
              {t(`points.${point}`)}
            </li>
          ))}
        </ul>
        <div className="mt-7 flex flex-col gap-2 sm:flex-row">
          <Button asChild size="lg" className="h-12 rounded-xl px-6 text-base shadow-elevated">
            <Link href="/quotes/new">
              <Plus aria-hidden="true" className="!size-5" />
              {t("cta")}
            </Link>
          </Button>
          {showCompanyLink ? (
            <Button asChild size="lg" variant="ghost" className="h-12 rounded-xl px-5 text-base">
              <Link href="/settings">{t("secondary")}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
