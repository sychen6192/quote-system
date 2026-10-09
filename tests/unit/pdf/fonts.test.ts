jest.mock("@react-pdf/renderer", () => ({
  Font: { register: jest.fn(), registerHyphenationCallback: jest.fn() },
}));

import * as fs from "node:fs";
import * as path from "node:path";
import { Font } from "@react-pdf/renderer";
import { PDF_FONT_FAMILY, pdfFontPath, registerPdfFonts } from "@/lib/pdf/fonts";
import { pdfLineBreakSyllables } from "@/lib/pdf/line-break";

const REGISTERED = Symbol.for("quote-system.pdf-fonts");

beforeEach(() => {
  delete (globalThis as { [REGISTERED]?: unknown })[REGISTERED];
});

describe("registerPdfFonts", () => {
  it("registers Regular (400) and Bold (700) from assets/fonts", () => {
    registerPdfFonts();
    expect(Font.register).toHaveBeenCalledTimes(1);
    expect(Font.register).toHaveBeenCalledWith({
      family: PDF_FONT_FAMILY,
      fonts: [
        { src: path.join(process.cwd(), "assets", "fonts", "NotoSansTC-Regular.ttf"), fontWeight: 400 },
        { src: path.join(process.cwd(), "assets", "fonts", "NotoSansTC-Bold.ttf"), fontWeight: 700 },
      ],
    });
  });

  it("installs the CJK-safe line-break callback", () => {
    registerPdfFonts();
    expect(Font.registerHyphenationCallback).toHaveBeenCalledWith(pdfLineBreakSyllables);
  });

  it("is idempotent", () => {
    registerPdfFonts();
    registerPdfFonts();
    registerPdfFonts();
    expect(Font.register).toHaveBeenCalledTimes(1);
    expect(Font.registerHyphenationCallback).toHaveBeenCalledTimes(1);
  });

  it("registers again with another copy of react-pdf (one registry per Font)", () => {
    registerPdfFonts();
    jest.resetModules();
    jest.doMock("@react-pdf/renderer", () => ({
      Font: { register: jest.fn(), registerHyphenationCallback: jest.fn() },
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const other = require("@react-pdf/renderer") as typeof import("@react-pdf/renderer");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fonts = require("@/lib/pdf/fonts") as typeof import("@/lib/pdf/fonts");
    expect(other.Font).not.toBe(Font);
    fonts.registerPdfFonts();
    fonts.registerPdfFonts();
    expect(other.Font.register).toHaveBeenCalledTimes(1);
    expect(other.Font.registerHyphenationCallback).toHaveBeenCalledTimes(1);
    expect(Font.register).toHaveBeenCalledTimes(1);
  });

  it.each(["NotoSansTC-Regular.ttf", "NotoSansTC-Bold.ttf"] as const)(
    "ships %s outside public/",
    (file) => {
      expect(fs.statSync(pdfFontPath(file)).size).toBeGreaterThan(1_000_000);
      expect(fs.existsSync(path.join(process.cwd(), "public", "fonts", file))).toBe(false);
    }
  );
});
