import { LONG_RUN_CHARS, pdfLineBreakSyllables } from "@/lib/pdf/line-break";

describe("pdfLineBreakSyllables", () => {
  it.each<[string, string[]]>([
    // Latin words are never hyphenated…
    ["quotation", ["quotation"]],
    ["internationalization", ["internationalization"]],
    ["sales@example.com", ["sales@example.com"]],
    ["QT-20261009-001", ["QT-20261009-001"]],
    ["0123-456-789", ["0123-456-789"]],
    ["1/2", ["1/2"]],
    // …but may break after an existing hyphen or slash before a letter.
    ["Wi-Fi", ["Wi-", "", "Fi"]],
    ["https://acme.test/path", ["https://", "", "acme.test/", "", "path"]],
    // CJK: a zero-width break ("") between characters, never a hyphen.
    ["報價單", ["報", "", "價", "", "單"]],
    // Closing punctuation stays on the line, opening punctuation with what follows.
    ["天，逾期。", ["天，", "", "逾", "", "期。"]],
    ["「付款」", ["「付", "", "款」"]],
    ["(含稅)", ["(含", "", "稅)"]],
    // Mixed runs: breaks between scripts, Latin runs stay whole.
    ["帳號0123-456-789，", ["帳", "", "號", "", "0123-456-789，"]],
    ["月結30天", ["月", "", "結", "", "30", "", "天"]],
    // Kana / prolonged sound mark never starts a line.
    ["データー", ["デー", "", "ター"]],
    // Astral-plane ideographs are single characters.
    ["𠀀𠀁", ["𠀀", "", "𠀁"]],
    ["", [""]],
  ])("%p → %p", (word, expected) => {
    expect(pdfLineBreakSyllables(word)).toEqual(expected);
  });

  it.each([
    "本報價單有效期限為三十天，逾期請重新詢價。",
    "請匯款至Acme帳號0123-456-789（註明QT-20261009-001）",
    "Extraordinarily-long-hyphenated-compound",
    "混合English與中文、全形：標點！",
  ])("joins back to the original word: %p", (word) => {
    expect(pdfLineBreakSyllables(word).join("")).toBe(word);
  });

  it("never returns two non-empty syllables in a row (react-pdf would insert a hyphen)", () => {
    const syllables = pdfLineBreakSyllables("本報價單Wi-Fi設備（含安裝）、月結30天。");
    for (let i = 1; i < syllables.length; i++) {
      expect(syllables[i] === "" || syllables[i - 1] === "").toBe(true);
    }
  });
});

// A SKU, hash or URL wider than its box must still wrap, in every PDF text
// (the callback is registered globally), not run over the next column.
describe("pdfLineBreakSyllables: long Latin runs", () => {
  const nonEmpty = (syllables: string[]) => syllables.filter((s) => s !== "");

  it("keeps runs up to LONG_RUN_CHARS whole", () => {
    const run = "A".repeat(LONG_RUN_CHARS);
    expect(pdfLineBreakSyllables(run)).toEqual([run]);
  });

  it("lets a longer run break between any two characters, without hyphens", () => {
    const sku = "SKU0123456789ABCDEFGHIJKLMNOP";
    const syllables = pdfLineBreakSyllables(sku);
    expect(nonEmpty(syllables)).toEqual(Array.from(sku));
    expect(syllables.join("")).toBe(sku);
    for (let i = 1; i < syllables.length; i++) {
      expect(syllables[i] === "" || syllables[i - 1] === "").toBe(true);
    }
  });

  it("keeps closing punctuation with the character before it", () => {
    const hash = "0123456789abcdef0123456789abcdef).";
    expect(nonEmpty(pdfLineBreakSyllables(hash)).pop()).toBe("f).");
  });

  it("splits a long run inside mixed CJK text and long URL segments", () => {
    const word = "見https://example.test/a0123456789b0123456789c0123456789";
    const syllables = pdfLineBreakSyllables(word);
    expect(syllables.join("")).toBe(word);
    expect(Math.max(...nonEmpty(syllables).map((s) => Array.from(s).length))).toBeLessThanOrEqual(LONG_RUN_CHARS);
  });
});
