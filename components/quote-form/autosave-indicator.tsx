// Adapted from Invoify (https://github.com/al1abb/invoify), MIT License, Copyright (c) 2023 Ali Abbasov.
"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Check, CloudOff, Loader2 } from "lucide-react";
import { useDraftStatus, type DraftStatusStore } from "@/hooks/use-form-draft";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { cn } from "@/lib/utils";

const MINUTE = 60_000;

/** "just now" under a minute, then "2 minutes ago" / "2 分鐘前" (device clock). */
function useRelativeAge(savedAt: number | null): string | null {
  const t = useTranslations("QuoteForm.autosave");
  const locale = useLocale();
  // Ticks every 30 s while there is something to show; 0 until the first
  // tick, which reads as "just now" for a save that just happened.
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (savedAt === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [savedAt]);
  if (savedAt === null) return null;
  const age = Math.max(0, now - savedAt);
  if (age < MINUTE) return t("justNow");
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const minutes = Math.floor(age / MINUTE);
  return minutes < 60
    ? rtf.format(-minutes, "minute")
    : rtf.format(-Math.floor(minutes / 60), "hour");
}

export function AutosaveIndicator({
  store,
  className,
}: {
  store: DraftStatusStore;
  className?: string;
}) {
  const t = useTranslations("QuoteForm.autosave");
  const { status, savedAt } = useDraftStatus(store);
  const online = useOnlineStatus();
  const age = useRelativeAge(savedAt);

  const base = cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className);

  if (!online) {
    return (
      <span className={cn(base, "font-medium text-warning")}>
        <CloudOff aria-hidden="true" className="size-3.5" />
        {t("offline")}
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className={base}>
        <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
        {t("saving")}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className={cn(base, "text-warning")}>
        <AlertTriangle aria-hidden="true" className="size-3.5" />
        {t("failed")}
      </span>
    );
  }
  if (status === "saved" && age) {
    return (
      <span className={base}>
        <Check aria-hidden="true" className="size-3.5 text-success" />
        {t("saved", { when: age })}
      </span>
    );
  }
  return null;
}
