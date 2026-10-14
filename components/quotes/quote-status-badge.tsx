import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { displayStatus, isDisplayStatus, type DisplayStatus } from "@/lib/status";

// Token colours (they reach 4.5:1 on their own /10 tint in both themes).
const TONE: Record<DisplayStatus, { pill: string; dot: string }> = {
  draft: { pill: "bg-muted text-muted-foreground ring-border", dot: "bg-muted-foreground" },
  sent: { pill: "bg-info/10 text-info ring-info/25", dot: "bg-info" },
  accepted: { pill: "bg-success/10 text-success ring-success/25", dot: "bg-success" },
  rejected: { pill: "bg-destructive/10 text-destructive ring-destructive/25", dot: "bg-destructive" },
  expired: { pill: "bg-warning/10 text-warning ring-warning/25", dot: "bg-warning" },
};

// The A4 paper stays white in dark mode, so it gets fixed light colours.
const PAPER: Record<DisplayStatus, { pill: string; dot: string }> = {
  draft: { pill: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-500" },
  sent: { pill: "bg-sky-50 text-sky-800 ring-sky-200", dot: "bg-sky-600" },
  accepted: { pill: "bg-green-50 text-green-800 ring-green-200", dot: "bg-green-600" },
  rejected: { pill: "bg-red-50 text-red-800 ring-red-200", dot: "bg-red-600" },
  expired: { pill: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-600" },
};

/** A status's colour as a dot, for menus that list the statuses. */
export function StatusDot({ status }: { status: DisplayStatus }) {
  return <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", TONE[status].dot)} />;
}

interface Props {
  /**
   * The display status, computed on the server with
   * displayStatus(status, validUntil, today) in the business timezone.
   * Unknown values render as draft.
   */
  status: DisplayStatus | string | null | undefined;
  /** @deprecated Pass the display status instead. Only used together with `today`. */
  validUntil?: Date | string | null;
  /** YYYY-MM-DD in the business timezone (never the browser clock). */
  today?: string;
  /** Fixed light colours, for the always-white quote document. */
  forceLight?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({
  status,
  validUntil,
  today,
  forceLight = false,
  size = "sm",
  className,
}: Props) {
  const t = useTranslations("Status");
  const key: DisplayStatus =
    validUntil && today
      ? displayStatus(status, validUntil, today)
      : isDisplayStatus(status)
        ? status
        : "draft";
  const tone = (forceLight ? PAPER : TONE)[key];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        tone.pill,
        className
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", tone.dot)} />
      {t(key)}
    </span>
  );
}
