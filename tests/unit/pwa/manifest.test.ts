import { buildManifest, manifestShortName, negotiateManifestLocale, type ManifestText } from "@/lib/pwa/manifest";

const TEXT: ManifestText = {
  description: "d",
  newQuote: "New quote",
  newQuoteDescription: "nd",
  quotes: "Quotes",
  quotesDescription: "qd",
  customers: "Customers",
  customersDescription: "cd",
};

const ZH_TEXT: ManifestText = { ...TEXT, description: "建立、寄送與追蹤報價單。", newQuote: "新增報價單" };

describe("buildManifest", () => {
  const manifest = buildManifest({
    appName: "宏達電子股份有限公司",
    themeColor: "#1D4ED8",
    iconVersion: "abc",
    text: TEXT,
  });

  it("has a stable identity and app-like display", () => {
    expect(manifest).toMatchObject({
      id: "/",
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "any",
      background_color: "#ffffff",
      theme_color: "#1D4ED8",
      categories: ["business", "finance", "productivity"],
      launch_handler: { client_mode: "navigate-existing" },
    });
    expect(manifest).not.toHaveProperty("lang");
  });

  it("keeps name and short_name independent of the language", () => {
    const zh = buildManifest({ appName: "宏達電子股份有限公司", themeColor: "#1D4ED8", iconVersion: "abc", text: ZH_TEXT });
    expect(zh.name).toBe(manifest.name);
    expect(zh.short_name).toBe(manifest.short_name);
    expect(zh.description).not.toBe(manifest.description);
    expect(manifest.name).toBe("宏達電子股份有限公司");
    expect(manifest.short_name).toBe("宏達電子");
  });

  it("lists separate 'any' and 'maskable' icons at 192 and 512, all versioned", () => {
    const icons = manifest.icons!;
    const by = (purpose: string) => icons.filter((i) => i.purpose === purpose).map((i) => i.sizes);
    expect(by("any")).toEqual(["192x192", "512x512"]);
    expect(by("maskable")).toEqual(["192x192", "512x512"]);
    for (const icon of icons) {
      expect(icon.type).toBe("image/png");
      expect(icon.src).toMatch(/^\/icons\/[a-z0-9-]+\.png\?v=abc$/);
    }
  });

  it("has New quote, Quotes and Customers shortcuts with 96 px icons", () => {
    expect(manifest.shortcuts!.map((s) => [s.name, s.url])).toEqual([
      ["New quote", "/quotes/new"],
      ["Quotes", "/quotes"],
      ["Customers", "/customers"],
    ]);
    for (const shortcut of manifest.shortcuts!) {
      expect(shortcut.icons).toEqual([expect.objectContaining({ sizes: "96x96", type: "image/png" })]);
    }
  });
});

describe("manifestShortName", () => {
  it("drops legal suffixes", () => {
    expect(manifestShortName("日昇貿易有限公司")).toBe("日昇貿易");
    expect(manifestShortName("Acme Inc.")).toBe("Acme");
    expect(manifestShortName("Quote System")).toBe("Quote System");
  });

  it("never exceeds 12 characters, preferring a word boundary", () => {
    expect(manifestShortName("Northwind Trading Company")).toBe("Northwind");
    expect(manifestShortName("Supercalifragilistic")).toBe("Supercalifra");
    expect(Array.from(manifestShortName("台灣積體電路製造股份有限公司")).length).toBeLessThanOrEqual(12);
  });

  it("counts characters, not UTF-16 units", () => {
    expect(manifestShortName("𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷")).toBe("𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷");
  });
});

describe("negotiateManifestLocale", () => {
  it.each([
    ["zh-TW,zh;q=0.9,en;q=0.8", "zh-TW"],
    ["zh-CN", "zh-TW"],
    ["zh-Hant-TW", "zh-TW"],
    ["en-US,en;q=0.9", "en"],
    ["fr-FR,zh-TW;q=0.5", "zh-TW"],
    ["en;q=0.4,zh-TW;q=0.8", "zh-TW"],
    ["zh-TW;q=0,en", "en"],
    ["*", "en"],
    ["", "en"],
    [null, "en"],
  ])("%s → %s", (header, expected) => {
    expect(negotiateManifestLocale(header)).toBe(expected);
  });
});
