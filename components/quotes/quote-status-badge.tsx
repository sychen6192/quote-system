import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { statusStyle, EXPIRED_STYLE } from "@/lib/status";

interface Props {
  status: string | null;
  validUntil?: Date | string | null;
}

export function StatusBadge({ status, validUntil }: Props) {
  const t = useTranslations("Status");
  const expired = validUntil ? new Date(validUntil) < new Date() : false;
  const key = status || "draft";
  const cls = expired ? EXPIRED_STYLE : statusStyle(key);
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
