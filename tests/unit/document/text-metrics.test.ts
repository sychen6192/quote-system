import { estimateLineCount, textWidthEm } from "@/components/pdf/text-metrics";

describe("textWidthEm", () => {
  it("counts CJK and full-width characters as one em, others as 0.6", () => {
    expect(textWidthEm("報價單")).toBe(3);
    expect(textWidthEm("（！）")).toBe(3);
    expect(textWidthEm("abcde")).toBeCloseTo(3);
    expect(textWidthEm("")).toBe(0);
  });
});

describe("estimateLineCount", () => {
  it("is 0 for empty text and at least one line per paragraph", () => {
    expect(estimateLineCount("", 60)).toBe(0);
    expect(estimateLineCount("a", 60)).toBe(1);
    expect(estimateLineCount("a\n\nb", 60)).toBe(3);
  });

  it("wraps Chinese sooner than Latin text of the same length", () => {
    const zh = "感".repeat(100);
    const en = "a".repeat(100);
    expect(estimateLineCount(zh, 68)).toBe(2);
    expect(estimateLineCount(en, 68)).toBe(1);
    expect(estimateLineCount("感".repeat(150), 68)).toBe(3);
  });

  it("ignores a non-positive width", () => {
    expect(estimateLineCount("abc", 0)).toBe(0);
  });
});
