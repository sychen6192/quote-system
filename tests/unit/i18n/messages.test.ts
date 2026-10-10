import * as fs from "node:fs";
import * as path from "node:path";
import { MESSAGE_NAMESPACES } from "@/i18n/messages";
import { LOCALES } from "@/i18n/locales";

const ROOT = path.join(__dirname, "../../../messages");

function keyPaths(value: unknown, prefix = ""): string[] {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      keyPaths(v, prefix ? `${prefix}.${k}` : k)
    );
  }
  return [prefix];
}

function read(locale: string, ns: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(ROOT, locale, `${ns}.json`), "utf8"));
}

describe("i18n messages", () => {
  it.each(LOCALES)("every %s namespace file is registered", (locale) => {
    const files = fs
      .readdirSync(path.join(ROOT, locale))
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
      .sort();
    expect(files).toEqual([...MESSAGE_NAMESPACES].sort());
  });

  it.each([...MESSAGE_NAMESPACES])("%s has identical keys in every locale", (ns) => {
    const [base, ...others] = LOCALES;
    const expected = keyPaths(read(base, ns)).sort();
    for (const locale of others) {
      expect(keyPaths(read(locale, ns)).sort()).toEqual(expected);
    }
  });

  // Taiwanese UI register: 您 throughout (not 你), 儲存 for saving (not the
  // mainland 保存), and one word for each status.
  describe("zh-TW wording", () => {
    const strings = (value: unknown, prefix = ""): [string, string][] => {
      if (typeof value === "string") return [[prefix, value]];
      if (value && typeof value === "object") {
        return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
          strings(v, prefix ? `${prefix}.${k}` : k)
        );
      }
      return [];
    };
    const zh = MESSAGE_NAMESPACES.flatMap((ns) =>
      strings(read("zh-TW", ns)).map(([key, text]) => [`${ns}.${key}`, text] as const)
    );

    it("addresses the user as 您, never 你", () => {
      expect(zh.filter(([, text]) => /你(?!們)/.test(text)).map(([key]) => key)).toEqual([]);
    });

    it("says 儲存, not 保存", () => {
      expect(zh.filter(([, text]) => text.includes("保存")).map(([key]) => key)).toEqual([]);
    });

    it.each(LOCALES)("%s: the branding preview badge is the real 'sent' label", (locale) => {
      const settings = read(locale, "Settings") as { branding: { preview: { badge: string } } };
      const status = read(locale, "Status") as { sent: string };
      expect(settings.branding.preview.badge).toBe(status.sent);
    });
  });

});
