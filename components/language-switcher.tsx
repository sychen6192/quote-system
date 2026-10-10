"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Languages, Loader2 } from "lucide-react";
import { usePathname, useRouter } from "@/navigation";
import { LOCALES, type AppLocale } from "@/i18n/locales";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Each language is named in itself, so it is recognisable whatever the UI language.
const NAMES: Record<AppLocale, { short: string; full: string }> = {
  en: { short: "EN", full: "English" },
  "zh-TW": { short: "中文", full: "繁體中文" },
};

/** Two-locale toggle: shows the language it switches to. */
export default function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Nav.language");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const target = LOCALES.find((l) => l !== locale) ?? LOCALES[0];
  const name = NAMES[target];

  const switchLocale = () => {
    // Read at click time rather than via useSearchParams(), which would force
    // a Suspense boundary around the whole shell.
    const search = window.location.search;
    startTransition(() => {
      router.replace(`${pathname}${search}`, { locale: target, scroll: false });
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={switchLocale}
      disabled={pending}
      aria-busy={pending || undefined}
      aria-label={t("switchTo", { language: name.full })}
      title={t("switchTo", { language: name.full })}
      className={cn("h-11 min-w-11 gap-1.5 px-2.5 md:h-9 md:min-w-9", className)}
    >
      {pending ? (
        <Loader2 aria-hidden="true" className="animate-spin" />
      ) : (
        <Languages aria-hidden="true" />
      )}
      <span lang={target} className="text-sm font-medium">
        {name.short}
      </span>
    </Button>
  );
}

export { LanguageSwitcher };
