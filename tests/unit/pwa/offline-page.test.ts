import { escapeHtml, renderOfflinePage, safeCssColor, type OfflinePageText } from "@/lib/pwa/offline-page";

const text = (prefix: string): OfflinePageText => ({
  title: `${prefix} title`,
  description: `${prefix} description`,
  retry: `${prefix} retry`,
  checking: `${prefix} checking`,
  stillOffline: `${prefix} still`,
  autoReload: `${prefix} auto`,
  whileOffline: `${prefix} while`,
  tipDrafts: `${prefix} drafts`,
  tipConnection: `${prefix} connection`,
});

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
    for (const key of Object.keys(input.text.en) as (keyof OfflinePageText)[]) {
      expect(html).toContain(`<span lang="en">EN ${key === "stillOffline" ? "still" : key === "autoReload" ? "auto" : key === "whileOffline" ? "while" : key === "tipDrafts" ? "drafts" : key === "tipConnection" ? "connection" : key}</span>`);
    }
    expect(html).toContain('<span lang="zh-TW">ZH title</span>');
    expect(html).toContain('id="retry"');
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
