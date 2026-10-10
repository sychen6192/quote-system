import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Dashboard panel: icon + title (+ count badge / action) above its content. */
export function SectionCard({
  icon: Icon,
  title,
  description,
  count,
  countLabel,
  action,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  count?: number;
  /** What screen readers hear for the count badge, e.g. "4 quotes" */
  countLabel?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border bg-card shadow-card", className)}>
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
            {Icon ? <Icon aria-hidden="true" className="size-4 text-muted-foreground" /> : null}
            {title}
            {count ? (
              <>
                <span
                  aria-hidden={countLabel ? true : undefined}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground"
                >
                  {count}
                </span>
                {countLabel ? <span className="sr-only">{countLabel}</span> : null}
              </>
            ) : null}
          </h2>
          {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
