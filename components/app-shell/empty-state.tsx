import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Icon "illustration": a tinted tile on two offset rounded squares, so empty
 * and error states read as designed rather than blank.
 */
export function IconIllustration({
  icon: Icon,
  tone = "primary",
  className,
}: {
  icon: LucideIcon;
  tone?: "primary" | "muted" | "destructive" | "success";
  className?: string;
}) {
  const tile = {
    primary: "bg-primary text-primary-foreground",
    muted: "bg-muted-foreground/80 text-background",
    destructive: "bg-destructive text-destructive-foreground",
    success: "bg-success text-success-foreground",
  }[tone];
  const halo = {
    primary: "bg-primary/10",
    muted: "bg-muted-foreground/10",
    destructive: "bg-destructive/10",
    success: "bg-success/10",
  }[tone];
  return (
    <div aria-hidden="true" className={cn("relative h-20 w-20 shrink-0", className)}>
      <div className={cn("absolute inset-0 rotate-6 rounded-3xl", halo)} />
      <div className={cn("absolute inset-1 -rotate-3 rounded-3xl border border-dashed border-current opacity-20", tone === "primary" ? "text-primary" : "text-muted-foreground")} />
      <div className={cn("absolute inset-3 flex items-center justify-center rounded-2xl shadow-elevated", tile)}>
        <Icon className="size-7" strokeWidth={1.75} />
      </div>
    </div>
  );
}

/** Centered empty / no-results block for lists. */
export function EmptyState({
  icon,
  tone,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  tone?: "primary" | "muted" | "destructive" | "success";
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-card px-6 py-12 text-center shadow-card sm:py-16",
        className
      )}
    >
      <IconIllustration icon={icon} tone={tone} />
      <div className="max-w-sm space-y-1.5">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex flex-wrap justify-center gap-2 pt-1">{action}</div> : null}
    </div>
  );
}
