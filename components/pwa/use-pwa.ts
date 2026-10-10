"use client";

import { useSyncExternalStore } from "react";
import {
  STANDALONE_MEDIA_QUERY,
  installPlatform,
  isStandalone,
  type InstallPlatform,
} from "@/lib/pwa/platform";
import {
  getInstallPromptState,
  getServerInstallPromptState,
  subscribeInstallPrompt,
  type InstallPromptState,
} from "./install-prompt-store";

function subscribeStandalone(onChange: () => void) {
  const query = window.matchMedia(STANDALONE_MEDIA_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return isStandalone({
    displayModeStandalone: window.matchMedia(STANDALONE_MEDIA_QUERY).matches,
    navigatorStandalone: nav.standalone,
  });
}

/** Running as an installed app. false on the server and during hydration. */
export function useStandalone(): boolean {
  return useSyncExternalStore(subscribeStandalone, readStandalone, () => false);
}

const noSubscribe = () => () => {};

function readPlatform(): InstallPlatform {
  return installPlatform({
    userAgent: navigator.userAgent,
    platform: navigator.platform ?? "",
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
  });
}

/** "other" on the server and during hydration. */
export function useInstallPlatform(): InstallPlatform {
  return useSyncExternalStore(noSubscribe, readPlatform, () => "other");
}

export function useInstallPrompt(): InstallPromptState {
  return useSyncExternalStore(subscribeInstallPrompt, getInstallPromptState, getServerInstallPromptState);
}
