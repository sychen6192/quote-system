"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAppConfig } from "@/components/providers/app-config-provider";
import { PWA_LOGOUT_EVENT, isLoginPath, themeColorFor } from "@/lib/pwa/platform";
import { OfflineBanner } from "./offline-banner";
import { useInstallPrompt } from "./use-pwa";
import { clearServiceWorkerCaches, useServiceWorker } from "./use-service-worker";

// <meta name="theme-color"> follows the theme actually shown (manual choice
// included), so the status bar / title bar blends with the top bar.
function useThemeColorSync(pathname: string | null) {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (!resolvedTheme) return;
    const color = themeColorFor(resolvedTheme);
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    if (metas.length === 0) {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.content = color;
      document.head.appendChild(meta);
      return;
    }
    // Media-specific variants too: the user's choice beats the system's.
    metas.forEach((meta) => {
      meta.content = color;
    });
  }, [resolvedTheme, pathname]);
}

function useLogoutCacheClear(pathname: string | null) {
  useEffect(() => {
    const onLogout = () => void clearServiceWorkerCaches();
    window.addEventListener(PWA_LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(PWA_LOGOUT_EVENT, onLogout);
  }, []);

  // Also when the session ended some other way (expiry, another tab).
  useEffect(() => {
    if (pathname && isLoginPath(pathname)) void clearServiceWorkerCaches();
  }, [pathname]);
}

function useInstalledToast() {
  const t = useTranslations("Pwa.install");
  const { appName } = useAppConfig();
  const { installed } = useInstallPrompt();
  const shown = useRef(false);
  useEffect(() => {
    if (!installed || shown.current) return;
    shown.current = true;
    toast.success(t("installedTitle"), {
      id: "pwa-installed",
      description: t("installedDescription", { name: appName }),
    });
  }, [installed, t, appName]);
}

/**
 * Mounted once in the [locale] layout: service worker + update toast,
 * offline notice, theme-color sync, cache cleanup on sign-out and the
 * "installed" toast.
 */
export function PwaRoot() {
  const pathname = usePathname();
  useServiceWorker();
  useThemeColorSync(pathname);
  useLogoutCacheClear(pathname);
  useInstalledToast();
  return <OfflineBanner />;
}
