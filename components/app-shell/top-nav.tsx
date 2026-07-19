"use client";

import Image from "next/image";
import { Link, usePathname } from "@/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useAppConfig } from "@/components/providers/app-config-provider";
import { pickCompanyName } from "@/lib/company-name";
import LanguageSwitcher from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export function TopNav() {
  const t = useTranslations("Nav");
  const { companyName, companyNameLocal } = useAppConfig();
  const locale = useLocale();
  const displayName = pickCompanyName(companyName, companyNameLocal, locale);
  const pathname = usePathname();

  const links = [
    { href: "/", label: t("dashboard"), active: pathname === "/" },
    {
      href: "/quotes",
      label: t("quotes"),
      active: pathname.startsWith("/quotes"),
    },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur print:hidden">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-4 md:gap-6 md:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-semibold"
        >
          <Image
            src="/api/branding-icon"
            alt=""
            width={24}
            height={24}
            className="rounded"
            unoptimized
          />
          <span className="hidden max-w-[32vw] truncate sm:inline">
            {displayName}
          </span>
        </Link>
        <nav className="flex items-center gap-0.5 text-sm sm:gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "whitespace-nowrap rounded-md px-2.5 py-1.5 transition-colors sm:px-3",
                l.active
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
