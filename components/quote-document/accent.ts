// Brand-colour accents for the quote document, PDF and email. Pure. The
// paper is always white, so every colour is fixed (no dark mode) and any
// brand colour, even a pale yellow, must still give readable text.
import {
  DEFAULT_BRAND_COLOR,
  contrastRatio,
  hslToRgb,
  parseHexColor,
  rgbToHsl,
  type Rgb,
} from "@/lib/brand-color";

export type DocumentAccent = {
  /** the brand colour itself: bars, rules, borders */
  color: string;
  /** brand-coloured text: darkened until it reaches 4.5:1 on white */
  text: string;
  /** text on a `color` fill: white or ink, whichever reads */
  onColor: string;
  /** a pale tint for the total row / table header (≈ 7 % brand on white) */
  soft: string;
  /** a light rule colour (≈ 28 % brand on white) */
  border: string;
};

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
/** --paper-foreground, the document's ink */
export const DOCUMENT_INK = "#0f172a";
const INK = parseHexColor(DOCUMENT_INK)!;

function toHex({ r, g, b }: Rgb): string {
  const hex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
}

function mixWithWhite(color: Rgb, amount: number): Rgb {
  return {
    r: WHITE.r + (color.r - WHITE.r) * amount,
    g: WHITE.g + (color.g - WHITE.g) * amount,
    b: WHITE.b + (color.b - WHITE.b) * amount,
  };
}

/** Lowers lightness one step at a time until the colour reaches `ratio` on white. */
function readableOnWhite(color: Rgb, ratio: number): Rgb {
  if (contrastRatio(color, WHITE) >= ratio) return color;
  const hsl = rgbToHsl(color);
  for (let l = Math.floor(hsl.l); l >= 0; l--) {
    const candidate = hslToRgb({ ...hsl, l });
    if (contrastRatio(candidate, WHITE) >= ratio) return candidate;
  }
  return INK;
}

export function documentAccent(brandColor: string | null | undefined): DocumentAccent {
  const base = parseHexColor(brandColor ?? "") ?? parseHexColor(DEFAULT_BRAND_COLOR)!;
  const text = readableOnWhite(base, 4.5);
  const onColor = contrastRatio(WHITE, base) >= 4.5 || contrastRatio(WHITE, base) >= contrastRatio(INK, base)
    ? "#FFFFFF"
    : DOCUMENT_INK;
  return {
    color: toHex(base),
    text: toHex(text),
    onColor,
    soft: toHex(mixWithWhite(base, 0.07)),
    border: toHex(mixWithWhite(base, 0.28)),
  };
}
