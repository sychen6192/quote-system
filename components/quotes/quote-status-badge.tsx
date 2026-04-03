import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";

interface Props {
  validUntil: Date | string | null;
}

export function QuoteStatusBadge({ validUntil }: Props) {
  const t = useTranslations("QuotesList.status");

  if (!validUntil) return <Badge variant="outline">-</Badge>;

  const isExpired = new Date(validUntil) < new Date();

  if (isExpired) {
    return (
      <Badge variant="destructive" className="whitespace-nowrap">
        {t("expired")}
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className="bg-green-100 text-green-800 hover:bg-green-100 whitespace-nowrap"
    >
      {t("active")}
    </Badge>
  );
}
