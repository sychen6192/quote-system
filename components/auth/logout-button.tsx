"use client";

import type { FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

async function clearServiceWorkerCaches(): Promise<void> {
  try {
    if (!("caches" in window)) return;
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch {
    // Best effort: signing out must never be blocked by cache cleanup.
  }
}

export type LogoutButtonProps = {
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  /** false → icon-only button (the label stays available to screen readers). */
  showLabel?: boolean;
};

/**
 * POSTs to /api/auth/logout (clears the session cookie, 303 → login page).
 * Render it only when auth is enabled (PublicAppConfig.authEnabled).
 */
export function LogoutButton({
  className,
  variant = "ghost",
  size = "sm",
  showLabel = true,
}: LogoutButtonProps) {
  const t = useTranslations("Auth");
  const locale = useLocale();

  // Shared devices: drop anything the service worker cached before leaving.
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await clearServiceWorkerCaches();
    form.submit();
  }

  return (
    <form method="post" action="/api/auth/logout" onSubmit={onSubmit} className="contents">
      <input type="hidden" name="locale" value={locale} />
      <Button
        type="submit"
        variant={variant}
        size={showLabel ? size : "icon"}
        className={className}
        title={showLabel ? undefined : t("logout")}
      >
        <LogOut aria-hidden="true" />
        {showLabel ? t("logout") : <span className="sr-only">{t("logout")}</span>}
      </Button>
    </form>
  );
}
