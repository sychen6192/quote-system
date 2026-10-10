"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FilePlus2, History, Mail, PencilLine, Copy, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { StatusBadge } from "@/components/quotes/quote-status-badge";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";
import { activityEntries, relativeTime, type ActivityEntry, type QuoteEventRecord } from "./model";

const ICONS: Record<ActivityEntry["kind"], typeof Mail> = {
  created: FilePlus2,
  updated: PencilLine,
  duplicated: Copy,
  status: RefreshCw,
  emailed: Mail,
  unknown: History,
};

const TONES: Partial<Record<ActivityEntry["kind"], string>> = {
  created: "bg-primary/10 text-primary",
  emailed: "bg-info/10 text-info",
  status: "bg-success/10 text-success",
};

export function ActivityTimeline({
  events,
  now: serverNow,
  timeZone,
  headingId,
}: {
  events: QuoteEventRecord[];
  /** server time of the render (ms), so the first client render matches */
  now: number;
  timeZone: string;
  headingId: string;
}) {
  const t = useTranslations("QuoteDetail.activity");
  const locale = useLocale();
  const [now, setNow] = useState(serverNow);
  // Server and browser ICU may space times differently: the tooltip only renders client-side.
  const mounted = useMounted();
  const entries = useMemo(() => activityEntries(events), [events]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 60_000);
    // Back from another tab or the bfcache: the times may be stale.
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", tick);
    };
  }, []);

  const relative = useMemo(() => {
    const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    return (iso: string) => {
      const parts = relativeTime(Date.parse(iso), now);
      return parts ? format.format(parts.value, parts.unit) : t("justNow");
    };
  }, [locale, now, t]);

  const absolute = useMemo(() => {
    let format: Intl.DateTimeFormat;
    try {
      format = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone });
    } catch {
      format = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
    }
    return (iso: string) => format.format(new Date(iso));
  }, [locale, timeZone]);

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <ol aria-labelledby={headingId} className="relative space-y-5">
      {entries.map((entry, index) => {
        const Icon = ICONS[entry.kind];
        return (
          <li key={entry.id} className="relative flex gap-3">
            {index < entries.length - 1 ? (
              <span aria-hidden="true" className="absolute left-4 top-9 -bottom-4 w-px -translate-x-1/2 bg-border" />
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-4 ring-card",
                TONES[entry.kind]
              )}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="text-sm font-medium leading-snug text-foreground">
                <EntryText entry={entry} />
              </div>
              <time
                dateTime={entry.at}
                title={mounted ? absolute(entry.at) : undefined}
                className="mt-0.5 block text-xs tabular-nums text-muted-foreground"
              >
                {relative(entry.at)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function EntryText({ entry }: { entry: ActivityEntry }) {
  const t = useTranslations("QuoteDetail.activity");
  switch (entry.kind) {
    case "created":
      return t("created");
    case "updated":
      return t("updated");
    case "duplicated":
      return t("duplicated");
    case "unknown":
      return t("unknown");
    case "status":
      return (
        <span className="flex flex-wrap items-center gap-1.5">
          <span>{t("statusChanged")}</span>
          {entry.from ? (
            <>
              <StatusBadge status={entry.from} />
              <ArrowRight aria-hidden="true" className="size-3.5 text-muted-foreground" />
            </>
          ) : null}
          <StatusBadge status={entry.to} />
        </span>
      );
    case "emailed":
      return (
        <span className="block">
          <span className="break-words">{t("emailed", { to: entry.to })}</span>
          {entry.cc.length ? (
            <span className="mt-0.5 block break-words text-xs font-normal text-muted-foreground">
              {t("emailedCc", { cc: entry.cc.join(", ") })}
            </span>
          ) : null}
        </span>
      );
  }
}
