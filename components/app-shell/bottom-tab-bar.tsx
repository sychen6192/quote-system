"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, NEW_QUOTE_HREF, isNavActive, type NavKey } from "./nav-config";
import { NAV_ICONS } from "./nav-icons";

function TabLink({ navKey, href, pathname }: { navKey: NavKey; href: string; pathname: string }) {
  const t = useTranslations("Nav");
  const active = isNavActive(href, pathname);
  const Icon = NAV_ICONS[navKey];
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium leading-none transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
          active ? "bg-primary/10" : "group-hover:bg-muted"
        )}
      >
        <Icon className="size-5" strokeWidth={active ? 2.25 : 2} />
      </span>
      <span className="max-w-full truncate px-0.5">{t(`short.${navKey}`)}</span>
    </Link>
  );
}

/** Phone navigation: four sections around a prominent "new quote" button. */
export function BottomTabBar() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const [dashboard, quotes, customers, settings] = NAV_ITEMS;
  const creating = isNavActive(NEW_QUOTE_HREF, pathname);

  return (
    <nav
      aria-label={t("mainNavigation")}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-safe backdrop-blur-md supports-[backdrop-filter]:bg-background/90 md:hidden print:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5 items-stretch pl-safe-1 pr-safe-1">
        {[dashboard, quotes].map((item) => (
          <li key={item.key} className="min-w-0">
            <TabLink navKey={item.key} href={item.href} pathname={pathname} />
          </li>
        ))}
        <li className="flex min-w-0 justify-center">
          <Link
            href={NEW_QUOTE_HREF}
            aria-current={creating ? "page" : undefined}
            className="group flex flex-col items-center justify-end gap-1 pb-2 text-[11px] font-medium leading-none text-foreground"
          >
            <span
              aria-hidden="true"
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevated ring-4 ring-background transition-transform group-hover:bg-primary/90 group-active:scale-95"
            >
              <Plus className="size-7" strokeWidth={2.5} />
            </span>
            <span className="sr-only">{t("newQuote")}</span>
            <span aria-hidden="true">{t("short.new")}</span>
          </Link>
        </li>
        {[customers, settings].map((item) => (
          <li key={item.key} className="min-w-0">
            <TabLink navKey={item.key} href={item.href} pathname={pathname} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
