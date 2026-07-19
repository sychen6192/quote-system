import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { statusStyle, expiredStyle } from "@/lib/status";

interface Props {
  status: string | null;
  validUntil?: Date | string | null;
  /** Force light styling — use inside the always-white invoice document. */
  forceLight?: boolean;
}

export function StatusBadge({ status, validUntil, forceLight = false }: Props) {
  const t = useTranslations("Status");
  const expired = validUntil ? new Date(validUntil) < new Date() : false;
  const key = status || "draft";
  const cls = expired ? expiredStyle(forceLight) : statusStyle(key, forceLight);
  const label = expired ? t("expired") : t(key);

  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        cls
      )}
    >
      {label}
    </span>
  );
}
