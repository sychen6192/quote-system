"use client";

import { useLocale, useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { PWA_LOGOUT_EVENT } from "@/lib/pwa/platform";

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

  // Shared devices: PwaRoot drops the service worker's caches (keeping the
  // offline page) when it hears this event.
  function onSubmit() {
    window.dispatchEvent(new Event(PWA_LOGOUT_EVENT));
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
