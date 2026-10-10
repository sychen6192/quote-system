"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { WifiOff, X } from "lucide-react";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/use-online-status";

/** How long the full notice stays up before it shrinks to the badge. */
const COLLAPSE_AFTER_MS = 6000;

/**
 * "auto": just went offline, shrinks by itself. "open": the user opened it or
 * is interacting with it, stays. "closed": only the badge.
 */
type Mode = "auto" | "open" | "closed";

/**
 * While offline: a notice under the top bar that shrinks after a few seconds
 * to a small badge on the top bar's edge (a card held over the page would
 * cover titles and fields for as long as the outage lasts). Tapping the badge
 * brings the notice back. Remounted for every outage, so each starts expanded.
 */
function OfflineNotice() {
  const t = useTranslations("Pwa.network");
  const [mode, setMode] = useState<Mode>("auto");
  const panelId = useId();
  const badgeRef = useRef<HTMLButtonElement>(null);
  const refocusBadge = useRef(false);

  useEffect(() => {
    if (mode !== "auto") return;
    const timer = window.setTimeout(() => setMode("closed"), COLLAPSE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [mode]);

  useEffect(() => {
    if (mode === "closed" && refocusBadge.current) {
      refocusBadge.current = false;
      badgeRef.current?.focus();
    }
  }, [mode]);

  if (mode === "closed") {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+2.9375rem)] z-50 flex justify-center print:hidden">
        <button
          ref={badgeRef}
          type="button"
          aria-expanded={false}
          aria-controls={panelId}
          onClick={() => setMode("open")}
          className="pointer-events-auto relative inline-flex h-7 items-center gap-1.5 rounded-full border border-warning/40 bg-card px-3 text-xs font-semibold text-warning shadow-card transition-colors before:absolute before:-inset-x-1 before:-inset-y-2 before:content-[''] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:duration-200 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95"
        >
          <WifiOff aria-hidden="true" className="size-3.5" />
          {t("offlineBadge")}
        </button>
      </div>
    );
  }

  const close = () => {
    refocusBadge.current = true;
    setMode("closed");
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+4rem)] z-50 flex justify-center px-3 print:hidden sm:px-4">
      <div
        id={panelId}
        // Reading or reaching for it pins it open.
        onPointerEnter={() => setMode("open")}
        onFocus={() => setMode("open")}
        className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border border-warning/30 bg-card py-3 pl-4 pr-3 text-card-foreground shadow-elevated motion-safe:duration-300 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2"
      >
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning"
        >
          <WifiOff className="size-4" />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-semibold leading-5">{t("offlineTitle")}</p>
          <p className="text-pretty text-xs leading-5 text-muted-foreground">{t("offlineDescription")}</p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={t("hide")}
          title={t("hide")}
          className="-my-1.5 -mr-1.5 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:my-0 md:mr-0 md:size-8"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * The offline notice (see OfflineNotice) and a short "back online" toast
 * after. Screen readers hear the full message once, from a live region that
 * stays mounted so the change is announced.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const t = useTranslations("Pwa.network");
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      toast.success(t("backOnline"), { id: "pwa-network", duration: 3000 });
    }
  }, [online, t]);

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {online ? "" : t("offlineAnnouncement")}
      </p>
      {online ? null : <OfflineNotice />}
    </>
  );
}
