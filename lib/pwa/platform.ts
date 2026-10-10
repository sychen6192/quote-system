// Pure install / registration decisions for components/pwa (client-safe, no
// React), so every branch is unit-testable without a browser.

export type NavigatorInfo = {
  userAgent: string;
  /** navigator.platform ("MacIntel", "iPhone", …); "" when unknown. */
  platform: string;
  maxTouchPoints: number;
};

/**
 * iPhone, iPod or iPad, including iPadOS 13+ whose Safari reports a Mac
 * ("MacIntel") but has a touch screen. Every iOS browser is WebKit and can
 * add to the Home Screen since iOS 16.4, none fires beforeinstallprompt.
 */
export function isIos({ userAgent, platform, maxTouchPoints }: NavigatorInfo): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent) || /^(iPad|iPhone|iPod)/.test(platform)) return true;
  return platform === "MacIntel" && maxTouchPoints > 1;
}

/** Desktop Safari 17+ (macOS Sonoma), which has File → Add to Dock. */
export function isMacSafari(info: NavigatorInfo): boolean {
  if (isIos(info)) return false;
  const ua = info.userAgent;
  if (!/Macintosh/.test(ua) || !/Safari\//.test(ua)) return false;
  // Every other Mac browser also says "Safari/"; only Safari has none of these.
  if (/Chrome|Chromium|CriOS|Edg|Firefox|FxiOS|OPR|Opera|Brave|Vivaldi|Arc/.test(ua)) return false;
  const version = /Version\/(\d+)/.exec(ua);
  return version ? Number(version[1]) >= 17 : false;
}

export type InstallPlatform = "ios" | "macSafari" | "other";

export function installPlatform(info: NavigatorInfo): InstallPlatform {
  if (isIos(info)) return "ios";
  if (isMacSafari(info)) return "macSafari";
  return "other";
}

/** Running as an installed app (any app-like display mode, or iOS Home Screen). */
export function isStandalone(input: { displayModeStandalone: boolean; navigatorStandalone?: boolean }): boolean {
  return input.displayModeStandalone || input.navigatorStandalone === true;
}

/** Media query for every display mode an installed app can run in. */
export const STANDALONE_MEDIA_QUERY =
  "(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui), (display-mode: window-controls-overlay)";

export type InstallUi = "hidden" | "prompt" | "ios" | "macSafari";

/**
 * What the install button offers: the browser's own prompt when it gave us
 * one (Chromium), step-by-step help where the user has to do it by hand
 * (iOS, Safari on macOS), otherwise nothing.
 */
export function installUi(input: {
  standalone: boolean;
  canPrompt: boolean;
  platform: InstallPlatform;
}): InstallUi {
  if (input.standalone) return "hidden";
  if (input.canPrompt) return "prompt";
  if (input.platform === "ios") return "ios";
  if (input.platform === "macSafari") return "macSafari";
  return "hidden";
}

/**
 * Register /sw.js? Production builds only (a worker caching dev chunks makes
 * HMR misbehave), unless NEXT_PUBLIC_ENABLE_SW=1, and never on an insecure
 * origin (no navigator.serviceWorker there anyway).
 */
export function shouldRegisterServiceWorker(input: {
  nodeEnv: string | undefined;
  enableFlag: string | undefined;
  supported: boolean;
  secureContext: boolean;
  /** The kill-switch worker said so earlier in this tab session. */
  disabled: boolean;
}): boolean {
  if (!input.supported || !input.secureContext || input.disabled) return false;
  return input.nodeEnv === "production" || input.enableFlag === "1" || input.enableFlag === "true";
}

/** Throttle for registration.update(): at most once a minute from focus changes. */
export const UPDATE_CHECK_MIN_INTERVAL_MS = 60_000;
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60_000;

export function shouldCheckForUpdate(lastCheck: number, now: number, minInterval = UPDATE_CHECK_MIN_INTERVAL_MS): boolean {
  return now - lastCheck >= minInterval;
}

/** The light / dark colour for <meta name="theme-color">: the page background, so the bars blend in. */
export const THEME_COLORS = { light: "#ffffff", dark: "#090e1a" } as const;

export function themeColorFor(resolvedTheme: string | undefined): string {
  return resolvedTheme === "dark" ? THEME_COLORS.dark : THEME_COLORS.light;
}

/**
 * Window event sign-out controls dispatch before leaving
 * (`window.dispatchEvent(new Event(PWA_LOGOUT_EVENT))`): PwaRoot then has the
 * service worker drop its caches.
 */
export const PWA_LOGOUT_EVENT = "qs:logout";

/** "/en/login", "/zh-TW/login": signed out or the session expired. */
export function isLoginPath(pathname: string): boolean {
  return /^\/[^/]+\/login\/?$/.test(pathname);
}
