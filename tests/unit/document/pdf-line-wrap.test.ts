import { LONG_RUN_CHARS, pdfWrapSyllables } from "@/components/pdf/line-wrap";
import { pdfLineBreakSyllables } from "@/lib/pdf/line-break";

describe("pdfWrapSyllables", () => {
  it("always joins back to the original word", () => {
    for (const word of ["Consulting", "QT-20261009-001", "報價單說明", "PARTNUMBER0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", "id=0123456789012345678901234567890123456789&lang=zh"]) {
      expect(pdfWrapSyllables(word).join("")).toBe(word);
    }
  });

  it("leaves ordinary words and the CJK rules of the registered callback alone", () => {
    expect(pdfWrapSyllables("Consulting")).toEqual(["Consulting"]);
    expect(pdfWrapSyllables("QT-20261009-001")).toEqual(pdfLineBreakSyllables("QT-20261009-001"));
    expect(pdfWrapSyllables("交期為訂單確認後")).toEqual(pdfLineBreakSyllables("交期為訂單確認後"));
  });

  it("lets a run longer than any word break between any two characters, without a hyphen", () => {
    const run = "A".repeat(LONG_RUN_CHARS + 6);
    const syllables = pdfWrapSyllables(run);
    // every other syllable is an empty, zero-width break point
    expect(syllables.filter((s) => s === "")).toHaveLength(run.length - 1);
    expect(syllables.filter((s) => s !== "").every((s) => s.length === 1)).toBe(true);
  });

  it("keeps a run at the limit whole", () => {
    expect(pdfWrapSyllables("B".repeat(LONG_RUN_CHARS))).toEqual(["B".repeat(LONG_RUN_CHARS)]);
  });
});
