import * as fs from "node:fs";
import * as path from "node:path";
import { NextRequest } from "next/server";

const getPublicConfig = jest.fn();
const getIconVersion = jest.fn();

jest.mock("@/services/settings", () => ({
  getPublicConfig: (...args: unknown[]) => getPublicConfig(...args),
}));
jest.mock("@/lib/pwa/render-icon", () => ({
  getIconVersion: (...args: unknown[]) => getIconVersion(...args),
}));
// The real message files, looked up like next-intl does.
jest.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) => {
    const [file, ...prefix] = namespace.split(".");
    const messages = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../../../messages", locale, `${file}.json`), "utf8")
    ) as Record<string, unknown>;
    return (key: string) =>
      [...prefix, ...key.split(".")].reduce<unknown>(
        (node, part) => (node as Record<string, unknown>)[part],
        messages
      );
  },
}));

import * as route from "@/app/manifest.webmanifest/route";
import { buildManifest } from "@/lib/pwa/manifest";

const BASE = "http://localhost:3000/manifest.webmanifest";

function get(headers: Record<string, string> = {}) {
  return route.GET(new NextRequest(BASE, { headers }));
}

beforeEach(() => {
  getPublicConfig.mockResolvedValue({ appName: "Acme Ltd.", brandColor: "#0F766E" });
  getIconVersion.mockResolvedValue("icon42");
});

describe("GET /manifest.webmanifest", () => {
  it("is a dynamic Node.js route", () => {
    expect(route.dynamic).toBe("force-dynamic");
    expect(route.runtime).toBe("nodejs");
  });

  it("serves the manifest as application/manifest+json, revalidated on every fetch", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/manifest+json; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-cache");
    expect(res.headers.get("vary")).toBe("Accept-Language, Cookie");
  });

  it("returns exactly what the manifest builder makes from the runtime settings", async () => {
    const en = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../messages/en/Pwa.json"), "utf8"));
    const manifest = await (await get()).json();
    expect(manifest).toEqual(
      JSON.parse(
        JSON.stringify(
          buildManifest({
            appName: "Acme Ltd.",
            themeColor: "#0F766E",
            iconVersion: "icon42",
            text: { description: en.manifest.description, ...en.manifest.shortcuts },
          })
        )
      )
    );
    expect(manifest.icons.every((icon: { src: string }) => icon.src.endsWith("?v=icon42"))).toBe(true);
  });

  it("follows Accept-Language without a language cookie", async () => {
    const manifest = await (await get({ "accept-language": "zh-TW,zh;q=0.9,en;q=0.8" })).json();
    expect(manifest.description).toBe("建立、寄送與追蹤報價單。");
    expect(manifest.name).toBe("Acme Ltd.");
  });

  it("prefers the chosen UI language now that the browser sends cookies", async () => {
    const zh = await (await get({ "accept-language": "en", cookie: "NEXT_LOCALE=zh-TW" })).json();
    expect(zh.shortcuts[0].name).toBe("新增報價單");
    // An unknown cookie value falls back to Accept-Language.
    const en = await (await get({ "accept-language": "en", cookie: "NEXT_LOCALE=fr" })).json();
    expect(en.shortcuts[0].name).toBe("New quote");
  });
});
