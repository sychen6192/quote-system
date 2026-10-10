import {
  installPlatform,
  installUi,
  isIos,
  isLoginPath,
  isMacSafari,
  isStandalone,
  shouldCheckForUpdate,
  shouldRegisterServiceWorker,
  themeColorFor,
  UPDATE_CHECK_MIN_INTERVAL_MS,
} from "@/lib/pwa/platform";

const UA = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.0.0 Mobile/15E148 Safari/604.1",
  // iPadOS 13+ Safari asks for the desktop site and looks like a Mac.
  ipadDesktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
  macSafari17:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  macSafari16:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  macEdge:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
  macFirefox: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0",
  android:
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
  windowsChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
};

describe("isIos", () => {
  it("detects iPhone, including other iOS browsers", () => {
    expect(isIos({ userAgent: UA.iphone, platform: "iPhone", maxTouchPoints: 5 })).toBe(true);
    expect(isIos({ userAgent: UA.iphoneChrome, platform: "iPhone", maxTouchPoints: 5 })).toBe(true);
  });

  it("detects iPadOS that reports a Mac but has a touch screen", () => {
    expect(isIos({ userAgent: UA.ipadDesktop, platform: "MacIntel", maxTouchPoints: 5 })).toBe(true);
  });

  it("does not mistake a Mac or Android for iOS", () => {
    expect(isIos({ userAgent: UA.macSafari17, platform: "MacIntel", maxTouchPoints: 0 })).toBe(false);
    expect(isIos({ userAgent: UA.android, platform: "Linux armv81", maxTouchPoints: 5 })).toBe(false);
  });
});

describe("isMacSafari", () => {
  const mac = (userAgent: string) => ({ userAgent, platform: "MacIntel", maxTouchPoints: 0 });

  it("accepts Safari 17+ only (Add to Dock)", () => {
    expect(isMacSafari(mac(UA.macSafari17))).toBe(true);
    expect(isMacSafari(mac(UA.macSafari16))).toBe(false);
  });

  it("rejects other Mac browsers, which also say Safari/", () => {
    expect(isMacSafari(mac(UA.macChrome))).toBe(false);
    expect(isMacSafari(mac(UA.macEdge))).toBe(false);
    expect(isMacSafari(mac(UA.macFirefox))).toBe(false);
  });

  it("rejects iPadOS", () => {
    expect(isMacSafari({ userAgent: UA.ipadDesktop, platform: "MacIntel", maxTouchPoints: 5 })).toBe(false);
  });
});

describe("installPlatform / installUi", () => {
  it("classifies platforms", () => {
    expect(installPlatform({ userAgent: UA.iphone, platform: "iPhone", maxTouchPoints: 5 })).toBe("ios");
    expect(installPlatform({ userAgent: UA.macSafari17, platform: "MacIntel", maxTouchPoints: 0 })).toBe("macSafari");
    expect(installPlatform({ userAgent: UA.windowsChrome, platform: "Win32", maxTouchPoints: 0 })).toBe("other");
  });

  it("hides everything inside the installed app", () => {
    for (const platform of ["ios", "macSafari", "other"] as const) {
      expect(installUi({ standalone: true, canPrompt: true, platform })).toBe("hidden");
    }
  });

  it("prefers the browser prompt, then manual steps, else nothing", () => {
    expect(installUi({ standalone: false, canPrompt: true, platform: "other" })).toBe("prompt");
    expect(installUi({ standalone: false, canPrompt: false, platform: "ios" })).toBe("ios");
    expect(installUi({ standalone: false, canPrompt: false, platform: "macSafari" })).toBe("macSafari");
    expect(installUi({ standalone: false, canPrompt: false, platform: "other" })).toBe("hidden");
  });
});

describe("isStandalone", () => {
  it("is true for display-mode standalone or iOS navigator.standalone", () => {
    expect(isStandalone({ displayModeStandalone: true })).toBe(true);
    expect(isStandalone({ displayModeStandalone: false, navigatorStandalone: true })).toBe(true);
    expect(isStandalone({ displayModeStandalone: false, navigatorStandalone: false })).toBe(false);
    expect(isStandalone({ displayModeStandalone: false })).toBe(false);
  });
});

describe("shouldRegisterServiceWorker", () => {
  const base = { nodeEnv: "production", enableFlag: undefined, supported: true, secureContext: true, disabled: false };

  it("registers in production builds", () => {
    expect(shouldRegisterServiceWorker(base)).toBe(true);
  });

  it("skips development unless NEXT_PUBLIC_ENABLE_SW is set", () => {
    expect(shouldRegisterServiceWorker({ ...base, nodeEnv: "development" })).toBe(false);
    expect(shouldRegisterServiceWorker({ ...base, nodeEnv: "development", enableFlag: "1" })).toBe(true);
    expect(shouldRegisterServiceWorker({ ...base, nodeEnv: "development", enableFlag: "0" })).toBe(false);
  });

  it("never registers without support, on an insecure origin or after the kill switch", () => {
    expect(shouldRegisterServiceWorker({ ...base, supported: false })).toBe(false);
    expect(shouldRegisterServiceWorker({ ...base, secureContext: false })).toBe(false);
    expect(shouldRegisterServiceWorker({ ...base, disabled: true })).toBe(false);
  });
});

describe("update checks and theme colour", () => {
  it("throttles focus-driven update checks", () => {
    expect(shouldCheckForUpdate(0, UPDATE_CHECK_MIN_INTERVAL_MS - 1)).toBe(false);
    expect(shouldCheckForUpdate(0, UPDATE_CHECK_MIN_INTERVAL_MS)).toBe(true);
  });

  it("matches the page background of the resolved theme", () => {
    expect(themeColorFor("dark")).toBe("#090e1a");
    expect(themeColorFor("light")).toBe("#ffffff");
    expect(themeColorFor(undefined)).toBe("#ffffff");
  });

  it("recognises login pages", () => {
    expect(isLoginPath("/en/login")).toBe(true);
    expect(isLoginPath("/zh-TW/login")).toBe(true);
    expect(isLoginPath("/en/quotes")).toBe(false);
    expect(isLoginPath("/en/login/extra")).toBe(false);
  });
});
