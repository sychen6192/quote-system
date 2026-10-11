"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, ChevronRight, Circle, Rocket, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { cn } from "@/lib/utils";
import {
  APP_INSTALLED_COOKIE,
  SETUP_DISMISSED_COOKIE,
  SETUP_ITEMS,
  setupProgress,
  type SetupDone,
} from "./setup-state";

const DISMISSED_KEY = "qs.setupChecklist.dismissed";
const INSTALLED_KEY = "qs.app.installed";
const YEAR = 60 * 60 * 24 * 365;

function setCookie(name: string) {
  document.cookie = `${name}=1; path=/; max-age=${YEAR}; samesite=lax`;
}

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // storage blocked (private mode): the cookie still remembers it
  }
}

function markInstalled() {
  writeFlag(INSTALLED_KEY);
  setCookie(APP_INSTALLED_COOKIE);
}

function isInstalled(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    nav.standalone === true ||
    readFlag(INSTALLED_KEY)
  );
}

function subscribeInstalled(onChange: () => void) {
  const query = window.matchMedia("(display-mode: standalone)");
  const onInstalled = () => {
    markInstalled();
    onChange();
  };
  query.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    query.removeEventListener("change", onChange);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

const noSubscribe = () => () => {};

/**
 * Onboarding steps, shown until they are all done or the user hides it.
 * `done.install` comes from a cookie the client sets once it has seen the
 * app running installed (display-mode: standalone) or the appinstalled event.
 */
export function SetupChecklist({ done: serverDone, className }: { done: SetupDone; className?: string }) {
  const t = useTranslations("Onboarding.checklist");
  const installedNow = useSyncExternalStore(subscribeInstalled, isInstalled, () => false);
  const dismissedStored = useSyncExternalStore(noSubscribe, () => readFlag(DISMISSED_KEY), () => false);
  const [dismissed, setDismissed] = useState(false);

  const installed = serverDone.install || installedNow;
  useEffect(() => {
    // Remember it server-side so the next dashboard render can count it.
    if (installedNow && !serverDone.install) markInstalled();
  }, [installedNow, serverDone.install]);

  const done: SetupDone = { ...serverDone, install: installed };
  const progress = setupProgress(done);
  if (dismissed || dismissedStored || progress.complete) return null;

  const dismiss = () => {
    writeFlag(DISMISSED_KEY);
    setCookie(SETUP_DISMISSED_COOKIE);
    setDismissed(true);
  };

  return (
    <section
      aria-labelledby="setup-checklist-title"
      className={cn("relative overflow-hidden rounded-xl border bg-card shadow-card", className)}
    >
      <div className="flex items-start gap-3 px-5 pb-3 pt-4">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          <Rocket className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="setup-checklist-title" className="text-base font-semibold tracking-tight">
            {t("title")}
          </h2>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("dismiss")}
          title={t("dismiss")}
          className="-mr-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-9"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>

      <div className="flex items-center gap-3 px-5 pb-3">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
          aria-label={t("progress", { done: progress.done, total: progress.total })}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${(progress.done / progress.total) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          {t("progress", { done: progress.done, total: progress.total })}
        </span>
      </div>

      <ol className="border-t">
        {SETUP_ITEMS.map((item) => {
          const isDone = done[item.key];
          const body = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                  isDone ? "bg-success text-success-foreground" : "text-muted-foreground"
                )}
              >
                {isDone ? <Check className="size-3.5" strokeWidth={3} /> : <Circle className="size-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-sm font-medium",
                    isDone ? "text-muted-foreground line-through decoration-muted-foreground/50" : "text-foreground"
                  )}
                >
                  {t(`items.${item.key}.title`)}
                </span>
                {isDone ? <span className="sr-only">{t("done")}</span> : null}
              </span>
              {isDone ? null : (
                <ChevronRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
            </>
          );
          return (
            <li key={item.key} className="border-b last:border-0">
              {isDone ? (
                <div className="flex items-start gap-3 px-5 py-3">{body}</div>
              ) : (
                <Link
                  href={item.href}
                  className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/50"
                >
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
