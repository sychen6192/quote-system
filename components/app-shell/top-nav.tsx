"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/navigation";
import { useAppConfig } from "@/components/providers/app-config-provider";
import LanguageSwitcher from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { InstallAppButton } from "@/components/pwa/install-app-button";
import { LogoutButton } from "@/components/auth/logout-button";
import { cn } from "@/lib/utils";
import { brandDisplayName } from "./brand-name";
import { NAV_ITEMS, isNavActive } from "./nav-config";
import { NAV_ICONS } from "./nav-icons";

/**
 * Sticky top bar. md+: brand, section links and the preference controls.
 * Phones: a compact bar (brand + controls); sections live in the bottom tab bar.
 */
export function TopNav() {
  const t = useTranslations("Nav");
  const tMeta = useTranslations("Metadata");
  const config = useAppConfig();
  const locale = useLocale();
  const pathname = usePathname();
  const brand = brandDisplayName(config, locale, tMeta("title"));

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 pt-safe backdrop-blur-md supports-[backdrop-filter]:bg-background/70 print:hidden">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 pl-safe-4 pr-safe-2 md:gap-6 md:pl-safe-6 md:pr-safe-6 lg:pl-safe-8 lg:pr-safe-8">
        <Link
          href="/"
          aria-label={t("home", { name: brand })}
          className="flex min-w-0 items-center gap-2.5 rounded-lg font-semibold tracking-tight"
        >
          <Image
            src={config.iconUrl}
            alt=""
            width={32}
            height={32}
            unoptimized
            priority
            className="h-8 w-8 shrink-0 rounded-lg bg-white object-contain p-0.5 shadow-card ring-1 ring-border"
          />
          <span className="truncate text-[15px] md:max-w-[14rem] lg:max-w-[18rem]">{brand}</span>
        </Link>

        <nav aria-label={t("mainNavigation")} className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isNavActive(item.href, pathname);
              const Icon = NAV_ICONS[item.key];
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon aria-hidden="true" className="hidden size-4 lg:block" />
                    {t(item.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-0.5 md:gap-1">
          <InstallAppButton variant="icon" />
          <LanguageSwitcher />
          <ThemeToggle />
          {config.authEnabled ? (
            <LogoutButton
              showLabel={false}
              className="h-11 w-11 text-muted-foreground hover:text-foreground md:h-9 md:w-9"
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}
