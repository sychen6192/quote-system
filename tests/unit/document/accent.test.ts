import { documentAccent } from "@/components/quote-document/accent";
import { contrastRatio, parseHexColor } from "@/lib/brand-color";

const WHITE = { r: 255, g: 255, b: 255 };
const contrast = (hex: string) => contrastRatio(parseHexColor(hex)!, WHITE);

describe("documentAccent", () => {
  it("keeps a dark brand colour as-is for text", () => {
    const accent = documentAccent("#1D4ED8");
    expect(accent.color).toBe("#1D4ED8");
    expect(accent.text).toBe("#1D4ED8");
    expect(accent.onColor).toBe("#FFFFFF");
  });

  it.each(["#FACC15", "#22D3EE", "#F0F0F0", "#FFFFFF"])("darkens %s until text reaches 4.5:1 on white", (hex) => {
    const accent = documentAccent(hex);
    expect(accent.color).toBe(hex);
    expect(contrast(accent.text)).toBeGreaterThanOrEqual(4.5);
  });

  it("puts ink, not white, on a pale fill", () => {
    expect(documentAccent("#FACC15").onColor).toBe("#0f172a");
  });

  it("falls back to the default colour for invalid input", () => {
    expect(documentAccent("blue").color).toBe("#1D4ED8");
    expect(documentAccent(null).color).toBe("#1D4ED8");
  });

  it("derives pale tints that stay light", () => {
    const { soft, border } = documentAccent("#0F766E");
    expect(soft).toMatch(/^#[0-9A-F]{6}$/);
    expect(contrast(soft)).toBeLessThan(1.2);
    expect(contrast(border)).toBeLessThan(2);
  });
});
