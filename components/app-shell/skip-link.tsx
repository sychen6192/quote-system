import { useTranslations } from "next-intl";

/** First focusable element: jumps keyboard users past the navigation. */
export function SkipLink() {
  const t = useTranslations("Nav");
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-background focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-elevated focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {t("skipToContent")}
    </a>
  );
}
