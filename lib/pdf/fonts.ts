// Contract: idempotent; call before rendering any react-pdf document.
import "server-only";
import * as path from "node:path";
import { Font } from "@react-pdf/renderer";
import { pdfLineBreakSyllables } from "./line-break";

export const PDF_FONT_FAMILY = "Noto Sans TC";

/** Outside public/ so the 14 MB of TTFs are not web-served; traced via next.config. */
export function pdfFontPath(file: "NotoSansTC-Regular.ttf" | "NotoSansTC-Bold.ttf"): string {
  return path.join(process.cwd(), "assets", "fonts", file);
}

// Remembered per Font registry, not per module: routes and actions bundle
// this module separately but share one react-pdf (a server external
// package), where registering twice would add duplicate sources; and should
// react-pdf ever be bundled per route, each copy still gets its fonts.
const REGISTERED = Symbol.for("quote-system.pdf-fonts");

export function registerPdfFonts(): void {
  const g = globalThis as { [REGISTERED]?: WeakSet<object> };
  const registered = (g[REGISTERED] ??= new WeakSet());
  if (registered.has(Font)) return;
  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: pdfFontPath("NotoSansTC-Regular.ttf"), fontWeight: 400 },
      // Without it every fontWeight: "bold" silently renders as Regular.
      { src: pdfFontPath("NotoSansTC-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback(pdfLineBreakSyllables);
  registered.add(Font);
}
