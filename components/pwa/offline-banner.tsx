"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/use-online-status";

/**
 * A floating notice under the top bar while the browser is offline, and a
 * short "back online" toast after. Nothing on the server or while online.
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

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+4rem)] z-50 flex justify-center px-4 print:hidden"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border border-warning/30 bg-card px-4 py-3 text-card-foreground shadow-elevated duration-300 animate-in fade-in-0 slide-in-from-top-2">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning"
        >
          <WifiOff className="size-4" />
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="text-sm font-semibold leading-5">{t("offlineTitle")}</p>
          <p className="text-xs leading-5 text-muted-foreground">{t("offlineDescription")}</p>
        </div>
      </div>
    </div>
  );
}
