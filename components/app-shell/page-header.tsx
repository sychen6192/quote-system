import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Standard page width and gutters (matches the top nav). */
export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-7xl px-4 py-5 sm:py-6 md:px-6 md:py-8 lg:px-8",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Page title row: h1 + optional meta line on the left, actions on the right
 * (wrapping under the title when they do not fit).
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-4 gap-y-3",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem] md:leading-9">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
