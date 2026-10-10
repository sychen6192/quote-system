"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/navigation";
import { cn } from "@/lib/utils";
import { shellChrome } from "./nav-config";
import { SkipLink } from "./skip-link";
import { TopNav } from "./top-nav";
import { BottomTabBar } from "./bottom-tab-bar";

/**
 * Skip link, top nav, <main id="main"> and the phone tab bar. Which pieces
 * show depends on the route (nav-config.ts): none on the login page, no tab
 * bar where the page brings its own sticky action bar.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const chrome = shellChrome(pathname);

  return (
    <>
      {chrome.nav ? <SkipLink /> : null}
      {chrome.nav ? <TopNav /> : null}
      <main
        id="main"
        tabIndex={-1}
        className={cn(
          "bg-ground outline-none",
          chrome.nav ? "min-h-[calc(100dvh-3.5rem)]" : "min-h-dvh",
          // Room for the fixed tab bar (4rem) plus breathing space and the home indicator.
          chrome.tabBar && "pb-safe-20 md:pb-0"
        )}
      >
        {children}
      </main>
      {chrome.tabBar ? <BottomTabBar /> : null}
    </>
  );
}
