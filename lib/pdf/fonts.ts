// PLACEHOLDER — replaced in Wave A3 (fonts move to assets/fonts, Bold registered).
// Contract: idempotent; call before rendering any react-pdf document.
import path from "node:path";
import { Font } from "@react-pdf/renderer";

export const PDF_FONT_FAMILY = "Noto Sans TC";
let registered = false;

export function registerPdfFonts(): void {
  if (registered) return;
  Font.register({
    family: PDF_FONT_FAMILY,
    src: path.join(process.cwd(), "public", "fonts", "NotoSansTC-Regular.ttf"),
  });
  registered = true;
}
