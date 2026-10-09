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

});
