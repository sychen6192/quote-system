"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  UPDATE_CHECK_INTERVAL_MS,
  shouldCheckForUpdate,
  shouldRegisterServiceWorker,
} from "@/lib/pwa/platform";

const SW_URL = "/sw.js";
const UPDATE_TOAST_ID = "pwa-update";
/** Set for this tab session when the kill-switch worker (PWA_DISABLE_SW) answers. */
const DISABLED_KEY = "qs:sw-disabled";

const ENABLE_FLAG = process.env.NEXT_PUBLIC_ENABLE_SW;

function readDisabled(): boolean {
  try {
    return window.sessionStorage.getItem(DISABLED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDisabled() {
  try {
    window.sessionStorage.setItem(DISABLED_KEY, "1");
  } catch {
    // storage blocked: the kill switch just runs again next load
  }
}

function isOwnWorker(registration: ServiceWorkerRegistration): boolean {
  const worker = registration.active ?? registration.waiting ?? registration.installing;
  return worker ? new URL(worker.scriptURL).pathname === SW_URL : false;
}

/**
 * Asks the worker to drop its caches (logout). The worker re-adds the public
 * offline page itself; without a worker, clear Cache Storage directly.
 */
export async function clearServiceWorkerCaches(): Promise<void> {
  try {
    const controller = navigator.serviceWorker?.controller;
    if (controller) {
      controller.postMessage({ type: "CLEAR_CACHES" });
      return;
    }
    if (!("caches" in window)) return;
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("qs-")).map((key) => caches.delete(key)));
  } catch {
    // best effort
  }
}

/**
 * Registers /sw.js and drives updates: a new deploy's worker waits until the
 * user picks "Reload" in the toast (other tabs, possibly with unsaved forms,
 * are never reloaded behind their back).
 */
export function useServiceWorker(): void {
  const t = useTranslations("Pwa.update");
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  useEffect(() => {
    const supported = "serviceWorker" in navigator;
    const register = shouldRegisterServiceWorker({
      nodeEnv: process.env.NODE_ENV,
      enableFlag: ENABLE_FLAG,
      supported,
      secureContext: window.isSecureContext,
      disabled: readDisabled(),
    });

    if (!register) {
      // `next dev` on an origin that once ran a production build: a leftover
      // worker would serve stale chunks.
      if (supported && process.env.NODE_ENV !== "production" && !ENABLE_FLAG) {
        void navigator.serviceWorker
          .getRegistrations()
          .then((regs) => Promise.all(regs.filter(isOwnWorker).map((reg) => reg.unregister())))
          .catch(() => undefined);
      }
      return;
    }

    const container = navigator.serviceWorker;
    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;
    let reloadRequested = false;
    let lastCheck = Date.now();

    const showUpdateToast = (reg: ServiceWorkerRegistration) => {
      const tr = tRef.current;
      toast(tr("title"), {
        id: UPDATE_TOAST_ID,
        description: tr("description"),
        duration: Number.POSITIVE_INFINITY,
        action: {
          label: tr("reload"),
          onClick: () => {
            const waiting = reg.waiting;
            if (waiting) {
              reloadRequested = true;
              waiting.postMessage({ type: "SKIP_WAITING" });
            } else {
              // Another tab already switched to the new worker.
              window.location.reload();
            }
          },
        },
      });
    };

    const watch = (reg: ServiceWorkerRegistration) => {
      // No controller = first install: nothing to update from.
      if (reg.waiting && container.controller) showUpdateToast(reg);
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        installing?.addEventListener("statechange", () => {
          if (installing.state === "installed" && container.controller) showUpdateToast(reg);
        });
      });
    };

    const checkForUpdate = (force: boolean) => {
      if (!registration) return;
      const now = Date.now();
      if (!force && !shouldCheckForUpdate(lastCheck, now)) return;
      lastCheck = now;
      registration.update().catch(() => undefined); // offline: try again later
    };

    const onControllerChange = () => {
      if (reloadRequested) window.location.reload();
    };
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "SW_DISABLED") writeDisabled();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkForUpdate(false);
    };
    const start = () => {
      container
        .register(SW_URL, { scope: "/", updateViaCache: "none" })
        .then((reg) => {
          if (cancelled) return;
          registration = reg;
          watch(reg);
        })
        .catch((error: unknown) => {
          console.warn("Service worker registration failed:", error);
        });
    };

    container.addEventListener("controllerchange", onControllerChange);
    container.addEventListener("message", onMessage);
    document.addEventListener("visibilitychange", onVisibility);
    const interval = window.setInterval(() => checkForUpdate(true), UPDATE_CHECK_INTERVAL_MS);
    // After load, so the worker's install never competes with the first paint.
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });

    return () => {
      cancelled = true;
      container.removeEventListener("controllerchange", onControllerChange);
      container.removeEventListener("message", onMessage);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("load", start);
      window.clearInterval(interval);
    };
  }, []);
}
