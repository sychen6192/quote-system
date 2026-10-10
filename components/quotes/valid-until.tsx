import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { QuoteRowView } from "./quote-row";

/** Valid-until date, amber when it ends within a week, red once expired. */
export function ValidUntil({
  row,
  withLabel = false,
  className,
}: {
  row: Pick<QuoteRowView, "validUntilLabel" | "daysLeft" | "urgency">;
  /** "Valid until …" instead of the bare date (cards). */
  withLabel?: boolean;
  /** Layout/size only: the colour reflects the urgency. */
  className?: string;
}) {
  const t = useTranslations("QuotesList");
  const date = withLabel ? t("validUntil", { date: row.validUntilLabel }) : row.validUntilLabel;
  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-baseline gap-x-1.5 tabular-nums",
        row.urgency === "expired"
          ? "text-destructive"
          : row.urgency === "soon"
            ? "font-medium text-warning"
            : "text-muted-foreground",
        className
      )}
    >
      <span className="whitespace-nowrap">{date}</span>
      {row.urgency === "soon" && row.daysLeft !== null ? (
        <span className="whitespace-nowrap text-xs">· {t("daysLeft", { days: row.daysLeft })}</span>
      ) : null}
    </span>
  );
}
