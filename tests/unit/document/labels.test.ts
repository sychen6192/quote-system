import * as fs from "node:fs";
import * as path from "node:path";
import {
  QUOTE_DOC_LABEL_KEYS,
  buildQuoteDocumentLabels,
  fillLabel,
} from "@/components/quote-document/label-keys";
import { LOCALES } from "@/i18n/locales";
import { pdfDocumentLabels } from "@/lib/pdf/labels";

const ROOT = path.join(__dirname, "../../..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");
const messages = (locale: string, ns: string): Record<string, unknown> =>
  JSON.parse(read(`messages/${locale}/${ns}.json`));

function has(tree: unknown, dotted: string): boolean {
  let node: unknown = tree;
  for (const part of dotted.split(".")) {
    if (!node || typeof node !== "object" || !(part in (node as object))) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string";
}

describe("QuoteDoc labels", () => {
  it.each(LOCALES)("%s has exactly the keys the document uses", (locale) => {
    expect(Object.keys(messages(locale, "QuoteDoc")).sort()).toEqual([...QUOTE_DOC_LABEL_KEYS].sort());
  });

  it.each([
    "components/quote-document/quote-document.tsx",
    "components/pdf/QuotePDFDocument.tsx",
  ])("every labels.* read in %s is a declared key", (file) => {
    const used = [...read(file).matchAll(/\blabels\.(\w+)/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(10);
    for (const key of used) expect(QUOTE_DOC_LABEL_KEYS).toContain(key);
  });

  it("builds a complete object from a raw-message reader", () => {
    const labels = buildQuoteDocumentLabels((key) => (key === "title" ? "報價單" : undefined));
    expect(labels.title).toBe("報價單");
    expect(labels.total).toBe("");
    expect(Object.keys(labels)).toHaveLength(QUOTE_DOC_LABEL_KEYS.length);
  });

  it("gives the PDF the same strings as the messages", () => {
    expect(pdfDocumentLabels("zh-TW").title).toBe("報價單");
    expect(pdfDocumentLabels("en").tax).toBe("Tax ({rate}%)");
  });
});

describe("fillLabel", () => {
  it("replaces known placeholders and keeps unknown ones", () => {
    expect(fillLabel("營業稅（{rate}%）", { rate: "5" })).toBe("營業稅（5%）");
    expect(fillLabel("{current} / {total}", { current: 1, total: 2 })).toBe("1 / 2");
    expect(fillLabel("Hi {name}", {})).toBe("Hi {name}");
  });

  it("does not interpret $ patterns in values", () => {
    expect(fillLabel("Total {total}", { total: "$1,000 $&" })).toBe("Total $1,000 $&");
  });
});

// Static translation calls in the detail page components: useTranslations("NS")
// bound to a variable, then variable("literal.key") calls.
describe("detail page translation keys", () => {
  const dir = "components/quote-detail";
  const files = fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".tsx"));

  it.each(files)("%s only uses keys that exist in every locale", (file) => {
    // Each component binds its own `t`: check one top-level function at a time.
    const chunks = read(`${dir}/${file}`).split(/\n(?=(?:export )?function )/);
    let checked = 0;
    for (const chunk of chunks) {
      for (const [, variable, namespace] of chunk.matchAll(/const (\w+) = useTranslations\("([\w.]+)"\)/g)) {
        const [ns, ...prefix] = namespace.split(".");
        for (const [, key] of chunk.matchAll(new RegExp(`\\b${variable}\\("([\\w.]+)"`, "g"))) {
          const dotted = [...prefix, key].join(".");
          for (const locale of LOCALES) {
            expect([locale, ns, dotted, has(messages(locale, ns), dotted)]).toEqual([locale, ns, dotted, true]);
          }
          checked++;
        }
      }
    }
    if (/useTranslations/.test(read(`${dir}/${file}`))) expect(checked).toBeGreaterThan(0);
  });
});
