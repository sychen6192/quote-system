import { appIconLinks } from "@/components/app-shell/icon-links";
import { iconCacheControl, iconSpec, iconVersionToken } from "@/lib/pwa/icons";

function urls(links: ReturnType<typeof appIconLinks>): string[] {
  const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : value ? [value] : []);
  const { icon, apple } = links as { icon?: unknown; apple?: unknown };
  return [...list(icon), ...list(apple)].map((entry) =>
    typeof entry === "string" ? entry : (entry as { url: string }).url
  );
}

describe("appIconLinks", () => {
  const version = iconVersionToken("2026-10-10T08:00:00.000Z", "#0F766E");
  const links = appIconLinks(version);

  it("links the favicon, the 192 px icon and the Apple touch icon", () => {
    expect(urls(links).map((url) => new URL(url, "http://x").pathname)).toEqual([
      "/icons/favicon-32.png",
      "/icons/any-192.png",
      "/icons/apple-180.png",
    ]);
    for (const url of urls(links)) {
      expect(iconSpec(new URL(url, "http://x").pathname.slice("/icons/".length))).not.toBeNull();
    }
  });

  it("uses the icon token, so /icons/* caches them for a year", () => {
    for (const url of urls(links)) {
      const requested = new URL(url, "http://x").searchParams.get("v");
      expect(requested).toBe(version);
      expect(iconCacheControl(requested, version)).toBe("public, max-age=31536000, immutable");
    }
  });

  it("escapes the token in the query string", () => {
    expect(urls(appIconLinks("a b&c"))[0]).toBe("/icons/favicon-32.png?v=a%20b%26c");
  });
});
