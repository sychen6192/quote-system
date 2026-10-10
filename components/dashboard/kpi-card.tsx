import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@/navigation";
import { cn } from "@/lib/utils";

export type KpiTone = "info" | "success" | "primary" | "muted";

const CHIP: Record<KpiTone, string> = {
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  primary: "bg-primary/10 text-primary",
  muted: "bg-muted text-muted-foreground",
};

const ICON: Record<KpiTone, string> = {
  info: "text-info",
  success: "text-success",
  primary: "text-primary",
  muted: "text-muted-foreground",
};

/** A key figure that links to the filtered quotes list. */
export function KpiCard({
  href,
  label,
  value,
  hint,
  icon: Icon,
  tone,
  footer,
}: {
  href: string;
  label: string;
  value: ReactNode;
  hint: ReactNode;
  icon: LucideIcon;
  tone: KpiTone;
  /** e.g. a meter under the hint */
  footer?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative flex min-w-0 flex-col rounded-xl border bg-card p-4 shadow-card transition-[box-shadow,border-color] hover:border-primary/30 hover:shadow-elevated md:p-5 @container"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-start gap-1.5 text-sm font-medium leading-snug text-muted-foreground">
          {/* Narrow cards (2-up on phones) swap the chip for a small inline icon. */}
          <Icon aria-hidden="true" className={cn("mt-0.5 size-3.5 shrink-0 @[12rem]:hidden", ICON[tone])} />
          <span>{label}</span>
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "hidden size-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105 @[12rem]:flex",
            CHIP[tone]
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <div className="money mt-3 truncate text-xl font-semibold tracking-tight text-foreground @[12rem]:text-2xl @[16rem]:text-[1.75rem]">
        {value}
      </div>
      <div className="mt-1 text-xs leading-snug text-muted-foreground @[14rem]:text-sm">{hint}</div>
      {footer ? <div className="mt-3">{footer}</div> : null}
      <ArrowUpRight
        aria-hidden="true"
        className="absolute bottom-4 right-4 hidden size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 md:block"
      />
    </Link>
  );
}

/** Thin progress bar (0–1). */
export function Meter({ value, className }: { value: number; className?: string }) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <div aria-hidden="true" className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}
