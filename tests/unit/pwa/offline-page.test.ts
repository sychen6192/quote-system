import { runInNewContext } from "node:vm";
import {
  SERVER_POLL_MS,
  escapeHtml,
  renderOfflinePage,
  safeCssColor,
  type OfflinePageText,
} from "@/lib/pwa/offline-page";

const KEYS: (keyof OfflinePageText)[] = [
  "title",
  "description",
  "retry",
  "checking",
  "stillOffline",
  "autoReload",
  "whileOffline",
  "tipDrafts",
  "tipConnection",
  "serverTitle",
  "serverDescription",
  "serverStill",
  "serverAutoRetry",
  "serverWhile",
];

const text = (prefix: string) =>
  Object.fromEntries(KEYS.map((key) => [key, `${prefix} ${key}`])) as OfflinePageText;

const input = {
  text: { en: text("EN"), "zh-TW": text("ZH") },
  names: { en: "Acme <Inc>", "zh-TW": "宏達電子" },
  iconDataUri: "data:image/png;base64,AAAA",
  primary: {
    light: { background: "hsl(224 76% 48%)", foreground: "hsl(0 0% 100%)" },
    dark: { background: "hsl(217 91% 62%)", foreground: "hsl(222 47% 7%)" },
  },
};

describe("renderOfflinePage", () => {
  const html = renderOfflinePage(input);

  it("is a complete document with both languages", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    for (const key of KEYS) {
      expect(html).toContain(`<span lang="en">EN ${key}</span>`);
      expect(html).toContain(`<span lang="zh-TW">ZH ${key}</span>`);
    }
    expect(html).toContain('id="retry"');
  });

  it("pairs every offline message with its server-unreachable wording", () => {
    const pairs: [keyof OfflinePageText, keyof OfflinePageText][] = [
      ["title", "serverTitle"],
      ["description", "serverDescription"],
      ["stillOffline", "serverStill"],
      ["autoReload", "serverAutoRetry"],
      ["whileOffline", "serverWhile"],
    ];
    for (const [offline, server] of pairs) {
      expect(html).toMatch(
        new RegExp(`<span class="v-offline"><span lang="en">EN ${offline}</span>.*?</span><span class="v-server"><span lang="en">EN ${server}</span>`)
      );
    }
    expect(html).toContain('html[data-net="server"] .v-offline,html:not([data-net="server"]) .v-server{display:none}');
    expect(html).toContain(`},${SERVER_POLL_MS});`);
  });

  it("escapes the company name", () => {
    expect(html).toContain("Acme &lt;Inc&gt;");
    expect(html).not.toContain("Acme <Inc>");
  });

  it("keeps the titles' script data inert", () => {
    const evil = renderOfflinePage({ ...input, names: { en: "</script><script>alert(1)</script>", "zh-TW": "x" } });
    expect(evil).not.toContain("</script><script>alert(1)");
  });

  it("loads nothing from the network", () => {
    const urls = html.match(/(?:src|href)="([^"]+)"/g) ?? [];
    for (const attr of urls) expect(attr).toMatch(/="data:/);
    expect(html).not.toMatch(/<link\b/);
  });

  it("supports light and dark themes", () => {
    expect(html).toContain("prefers-color-scheme:dark");
    expect(html).toContain(":root.dark{");
    expect(html).toContain("--primary:hsl(224 76% 48%)");
    expect(html).toContain("--primary:hsl(217 91% 62%)");
  });

  it("omits the icon when there is none", () => {
    expect(renderOfflinePage({ ...input, iconDataUri: null })).not.toContain("<img");
  });
});

describe("head script", () => {
  const html = renderOfflinePage(input);
  const source = /<script>([^<]*)<\/script>/.exec(html)?.[1] ?? "";

  function run({ path = "/", cookie = "", language = "en-US", onLine = true } = {}) {
    const attributes: Record<string, string> = {};
    const documentElement = {
      lang: "",
      classList: { add: () => undefined },
      setAttribute: (name: string, value: string) => {
        attributes[name] = value;
      },
    };
    const document = { documentElement, cookie, title: "" };
    runInNewContext(source, {
      document,
      location: { pathname: path },
      navigator: { language, languages: [language], onLine },
      localStorage: { getItem: () => null },
    });
    return { lang: documentElement.lang, net: attributes["data-net"], title: document.title };
  }

  it("picks the language from the URL, then the cookie, then the browser", () => {
    expect(run({ path: "/zh-TW/quotes" }).lang).toBe("zh-TW");
    expect(run({ path: "/en/quotes", language: "zh-TW" }).lang).toBe("en");
    expect(run({ cookie: "a=1; NEXT_LOCALE=zh-TW" }).lang).toBe("zh-TW");
    expect(run({ language: "zh-HK" }).lang).toBe("zh-TW");
    expect(run({ language: "fr" }).lang).toBe("en");
  });

  it("tells a lost connection from a server that does not answer", () => {
    expect(run({ onLine: false })).toMatchObject({ net: "offline", title: "EN title · Acme <Inc>" });
    expect(run({ onLine: true, path: "/zh-TW" })).toMatchObject({ net: "server", title: "ZH serverTitle · 宏達電子" });
  });
});

describe("body script", () => {
  const html = renderOfflinePage(input);
  const scripts = html.match(/<script>([^<]*)<\/script>/g) ?? [];
  const source = scripts[1]?.replace(/<\/?script>/g, "") ?? "";

  function run(pathname: string) {
    const handlers: Record<string, () => void> = {};
    const location = { pathname, reload: jest.fn(), replace: jest.fn() };
    const element = { addEventListener: () => undefined, hasAttribute: () => false };
    runInNewContext(source, {
      document: { documentElement: { getAttribute: () => "offline", lang: "en" }, getElementById: () => element },
      window: { addEventListener: (type: string, fn: () => void) => (handlers[type] = fn) },
      location,
      setInterval: () => 0,
    });
    return { handlers, location };
  }

  it("reloads the page that failed once the connection is back", () => {
    const { handlers, location } = run("/zh-TW/quotes");
    handlers.online();
    expect(location.reload).toHaveBeenCalled();
    expect(location.replace).not.toHaveBeenCalled();
  });

  it("goes to the app instead of reloading /offline.html itself", () => {
    const { handlers, location } = run("/offline.html");
    handlers.online();
    expect(location.replace).toHaveBeenCalledWith("/");
    expect(location.reload).not.toHaveBeenCalled();
  });
});

describe("helpers", () => {
  it("escapes HTML", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });

  it("lets only plain colours into the CSS", () => {
    expect(safeCssColor("hsl(224 76% 48%)", "#000")).toBe("hsl(224 76% 48%)");
    expect(safeCssColor("#1D4ED8", "#000")).toBe("#1D4ED8");
    expect(safeCssColor("red;}body{display:none", "#000")).toBe("#000");
    expect(safeCssColor("hsl(1 2% 3%);x:y", "#000")).toBe("#000");
  });
});
