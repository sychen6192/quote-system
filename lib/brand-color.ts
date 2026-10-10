// Brand colour (Settings → Branding) → the UI's primary-colour CSS variables.
// Pure and client-safe. The values are HSL channel triplets ("224 76% 48%")
// because the Tailwind tokens are `hsl(var(--primary))`.

export const DEFAULT_BRAND_COLOR = "#1D4ED8";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export type Rgb = { r: number; g: number; b: number };
/** h in degrees [0, 360), s and l in percent [0, 100] */
export type Hsl = { h: number; s: number; l: number };

const WHITE: Hsl = { h: 0, s: 0, l: 100 };
// The same inks globals.css uses for text on light / dark surfaces.
const INK_LIGHT: Hsl = { h: 222, s: 47, l: 11 };
const INK_DARK: Hsl = { h: 222, s: 47, l: 7 };
/** --background in dark mode */
const DARK_BACKGROUND: Hsl = INK_DARK;

export function isBrandHex(value: unknown): value is string {
  return typeof value === "string" && HEX_RE.test(value);
}

export function parseHexColor(hex: string): Rgb | null {
  if (!isBrandHex(hex)) return null;
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1 ? [c, x, 0]
    : hp < 2 ? [x, c, 0]
    : hp < 3 ? [0, c, x]
    : hp < 4 ? [0, x, c]
    : hp < 5 ? [x, 0, c]
    : [c, 0, x];
  const m = ln - c / 2;
  const to255 = (v: number) => Math.round((v + m) * 255);
  return { r: to255(r1), g: to255(g1), b: to255(b1) };
}

/** WCAG 2.x relative luminance, 0 (black) – 1 (white). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio, 1 – 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const round = (hsl: Hsl): Hsl => ({
  h: Math.round(hsl.h) % 360,
  s: Math.round(hsl.s),
  l: Math.round(hsl.l),
});

/** "224 76% 48%" — the format of the tokens in globals.css. */
export function hslToken(hsl: Hsl): string {
  const { h, s, l } = round(hsl);
  return `${h} ${s}% ${l}%`;
}

function contrastHsl(a: Hsl, b: Hsl): number {
  return contrastRatio(hslToRgb(round(a)), hslToRgb(round(b)));
}

/** Moves lightness one step at a time until `ok` holds (or the bound is hit). */
function adjustLightness(color: Hsl, direction: -1 | 1, ok: (c: Hsl) => boolean, bound: number): Hsl {
  let current = round(color);
  while (!ok(current) && (direction < 0 ? current.l > bound : current.l < bound)) {
    current = { ...current, l: current.l + direction };
  }
  return current;
}

/**
 * White text when it reaches 4.5:1 (it looks best on a saturated brand
 * colour), otherwise whichever of white / ink contrasts more.
 */
function readableForeground(background: Hsl, ink: Hsl): Hsl {
  const white = contrastHsl(WHITE, background);
  if (white >= 4.5) return WHITE;
  return contrastHsl(ink, background) > white ? ink : WHITE;
}

export type BrandTokens = {
  primary: string;
  "primary-foreground": string;
  ring: string;
  accent: string;
  "accent-foreground": string;
  "chart-1": string;
};

export type BrandPalette = { light: BrandTokens; dark: BrandTokens };

/**
 * The light and dark token sets for a brand colour, or null for the default
 * colour (globals.css already holds its hand-tuned palette) and invalid input.
 */
export function brandPalette(hex: string | null | undefined): BrandPalette | null {
  const rgb = parseHexColor(hex ?? "");
  if (!rgb || hex!.toUpperCase() === DEFAULT_BRAND_COLOR) return null;
  const base = round(rgbToHsl(rgb));
  const grey = base.s < 10;

  // Light mode keeps the exact brand colour unless it is so pale that focus
  // rings, links and outlines would vanish on white (< 3:1): then darken it.
  const lightPrimary = adjustLightness(base, -1, (c) => contrastHsl(c, WHITE) >= 3, 0);
  const lightAccent: Hsl = { h: base.h, s: grey ? base.s : Math.min(100, Math.max(base.s, 60)), l: 97 };
  const lightAccentFg = adjustLightness(
    { h: base.h, s: grey ? base.s : Math.min(base.s, 71), l: 40 },
    -1,
    (c) => contrastHsl(c, lightAccent) >= 4.5,
    5
  );

  // Dark mode: a lighter variant (saturation kept in a range that neither
  // greys out nor turns neon) that still reads as text on the dark page.
  const darkPrimary = adjustLightness(
    {
      h: base.h,
      s: grey ? base.s : Math.min(80, Math.max(50, base.s)),
      l: Math.min(80, Math.max(50, base.l + 14)),
    },
    1,
    (c) => contrastHsl(c, DARK_BACKGROUND) >= 4.5,
    90
  );
  const darkAccent: Hsl = { h: base.h, s: Math.min(base.s, 33), l: 24 };

  const light = hslToken(lightPrimary);
  const dark = hslToken(darkPrimary);
  return {
    light: {
      primary: light,
      "primary-foreground": hslToken(readableForeground(lightPrimary, INK_LIGHT)),
      ring: light,
      accent: hslToken(lightAccent),
      "accent-foreground": hslToken(lightAccentFg),
      "chart-1": light,
    },
    dark: {
      primary: dark,
      "primary-foreground": hslToken(readableForeground(darkPrimary, INK_DARK)),
      ring: dark,
      accent: hslToken(darkAccent),
      "accent-foreground": "210 40% 96%",
      "chart-1": dark,
    },
  };
}

function block(selector: string, tokens: BrandTokens): string {
  const body = Object.entries(tokens)
    .map(([name, value]) => `--${name}:${value}`)
    .join(";");
  return `${selector}{${body}}`;
}

/**
 * CSS overriding the primary tokens for a brand colour; "" for the default
 * colour or invalid input. `html:root` / `html.dark` outrank globals.css's
 * `:root` / `.dark` whatever order the stylesheets load in. The output only
 * ever contains numbers produced here, so it is safe to inline.
 */
export function brandColorCss(hex: string | null | undefined): string {
  const palette = brandPalette(hex);
  if (!palette) return "";
  return `${block("html:root", palette.light)}${block("html.dark", palette.dark)}`;
}

/** The brand colour for meta theme-color / the top loader (default when invalid). */
export function brandHex(hex: string | null | undefined): string {
  return isBrandHex(hex) ? hex.toUpperCase() : DEFAULT_BRAND_COLOR;
}
