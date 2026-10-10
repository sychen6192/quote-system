import { BRAND_PRESETS } from "@/components/settings/branding-model";
import {
  DEFAULT_BRAND_COLOR,
  brandColorCss,
  brandHex,
  brandPalette,
  contrastRatio,
  hslToRgb,
  hslToken,
  parseHexColor,
  rgbToHsl,
} from "@/lib/brand-color";

const WHITE = { r: 255, g: 255, b: 255 };
const DARK_BG = hslToRgb({ h: 222, s: 47, l: 7 });
/** dark --card / --popover in globals.css */
const DARK_SURFACE = hslToRgb({ h: 221, s: 39, l: 16 });
/** light --ground in globals.css */
const LIGHT_GROUND = hslToRgb({ h: 220, s: 14, l: 94 });

function tokenToRgb(token: string) {
  const [h, s, l] = token.replace(/%/g, "").split(" ").map(Number);
  return hslToRgb({ h, s, l });
}

describe("colour conversions", () => {
  it("parses 6-digit hex only", () => {
    expect(parseHexColor("#1D4ED8")).toEqual({ r: 29, g: 78, b: 216 });
    expect(parseHexColor("#1d4ed8")).toEqual({ r: 29, g: 78, b: 216 });
    expect(parseHexColor("#fff")).toBeNull();
    expect(parseHexColor("1D4ED8")).toBeNull();
    expect(parseHexColor("#1D4ED8;}body{")).toBeNull();
  });

  it("converts the default brand colour to the token in globals.css", () => {
    expect(hslToken(rgbToHsl(parseHexColor(DEFAULT_BRAND_COLOR)!))).toBe("224 76% 48%");
  });

  it("round-trips through HSL", () => {
    for (const hex of ["#0F766E", "#B91C1C", "#FACC15", "#7C3AED", "#6B7280"]) {
      const rgb = parseHexColor(hex)!;
      const back = hslToRgb(rgbToHsl(rgb));
      expect(Math.abs(back.r - rgb.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - rgb.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - rgb.b)).toBeLessThanOrEqual(1);
    }
  });

  it("computes WCAG contrast", () => {
    expect(contrastRatio(WHITE, { r: 0, g: 0, b: 0 })).toBeCloseTo(21, 5);
    expect(contrastRatio(WHITE, WHITE)).toBeCloseTo(1, 5);
  });
});

describe("brandColorCss", () => {
  it("keeps today's palette for the default colour (no override)", () => {
    expect(brandColorCss(DEFAULT_BRAND_COLOR)).toBe("");
    expect(brandColorCss("#1d4ed8")).toBe("");
    expect(brandPalette(DEFAULT_BRAND_COLOR)).toBeNull();
  });

  it("ignores invalid input", () => {
    expect(brandColorCss("")).toBe("");
    expect(brandColorCss(null)).toBe("");
    expect(brandColorCss("red")).toBe("");
    expect(brandColorCss("#12345")).toBe("");
  });

  it("emits light and dark blocks with only safe characters", () => {
    const css = brandColorCss("#0F766E");
    expect(css).toMatch(/^html:root\{[^}]+\}html\.dark\{[^}]+\}$/);
    expect(css).toContain("--primary:");
    expect(css).toContain("--primary-foreground:");
    expect(css).toContain("--ring:");
    expect(css.replace(/html:root|html\.dark/g, "")).toMatch(/^[{}\-a-z0-9:;% ]+$/);
  });

  it("keeps a mid/dark brand colour exact in light mode, with white text", () => {
    const palette = brandPalette("#0F766E")!;
    expect(palette.light.primary).toBe(hslToken(rgbToHsl(parseHexColor("#0F766E")!)));
    expect(palette.light["primary-foreground"]).toBe("0 0% 100%");
    expect(palette.light.ring).toBe(palette.light.primary);
  });

  it("picks a readable foreground for every colour, in both modes", () => {
    for (const hex of ["#0F766E", "#16A34A", "#FACC15", "#7C3AED", "#000000", "#FFFFFF", "#0000FF", "#6B7280", "#E11D48"]) {
      const palette = brandPalette(hex)!;
      for (const mode of [palette.light, palette.dark]) {
        const ratio = contrastRatio(tokenToRgb(mode.primary), tokenToRgb(mode["primary-foreground"]));
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("dark mode primary reads as text on the dark page", () => {
    for (const hex of ["#0F766E", "#0000FF", "#7C3AED", "#000000", "#B91C1C"]) {
      const { dark } = brandPalette(hex)!;
      expect(contrastRatio(tokenToRgb(dark.primary), DARK_BG)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("dark mode primary is lighter than the light one", () => {
    const { light, dark } = brandPalette("#7C3AED")!;
    const l = (t: string) => Number(t.split(" ")[2].replace("%", ""));
    expect(l(dark.primary)).toBeGreaterThan(l(light.primary));
  });

  it("darkens a pale brand colour until it reads as text on white (>= 4.5:1)", () => {
    const { light } = brandPalette("#FACC15")!;
    expect(contrastRatio(tokenToRgb(light.primary), WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokenToRgb(light.primary), tokenToRgb(light["primary-foreground"]))).toBeGreaterThanOrEqual(4.5);
  });

  // The primary colour is link and button text: AA (4.5:1) on every surface
  // it sits on, for every preset offered in Settings and pale custom colours.
  it.each([
    ...BRAND_PRESETS.map((p) => p.hex).filter((hex) => hex !== DEFAULT_BRAND_COLOR),
    "#F59E0B",
    "#22C55E",
    "#06B6D4",
    "#EAB308",
    "#FDE68A",
    "#FFFFFF",
    "#000000",
  ])("%s: primary is readable text on page and cards, in both modes", (hex) => {
    const { light, dark } = brandPalette(hex)!;
    const lp = tokenToRgb(light.primary);
    const dp = tokenToRgb(dark.primary);
    expect(contrastRatio(lp, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(lp, LIGHT_GROUND)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(dp, DARK_BG)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(dp, DARK_SURFACE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(lp, tokenToRgb(light["primary-foreground"]))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(dp, tokenToRgb(dark["primary-foreground"]))).toBeGreaterThanOrEqual(4.5);
  });

  // Dark mode should feel like the brand, not glow: teal was #1DE2D1 (neon
  // cyan) and crimson's hover fill a brown-maroon.
  it("keeps dark-mode variants calm: capped saturation, no more lightness than contrast needs", () => {
    const parts = (token: string) => token.replace(/%/g, "").split(" ").map(Number);
    for (const { hex } of BRAND_PRESETS.filter((p) => p.hex !== DEFAULT_BRAND_COLOR)) {
      const [, s] = parts(brandPalette(hex)!.dark.primary);
      expect(s).toBeLessThanOrEqual(65);
    }
    const [, tealS, tealL] = parts(brandPalette("#0F766E")!.dark.primary);
    expect(tealS).toBeLessThanOrEqual(65);
    expect(tealL).toBeLessThan(50);
    for (const hex of ["#B91C1C", "#C2410C", "#E11D48"]) {
      const [, accentS] = parts(brandPalette(hex)!.dark.accent);
      expect(accentS).toBeLessThanOrEqual(14);
    }
    const [, coolAccentS] = parts(brandPalette("#0F766E")!.dark.accent);
    expect(coolAccentS).toBeLessThanOrEqual(28);
  });

  it("accent foreground reaches 4.5:1 on the accent tint", () => {
    for (const hex of ["#0F766E", "#FACC15", "#E11D48"]) {
      const { light } = brandPalette(hex)!;
      expect(
        contrastRatio(tokenToRgb(light["accent-foreground"]), tokenToRgb(light.accent))
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("brandHex", () => {
  it("normalises valid colours and falls back to the default", () => {
    expect(brandHex("#0f766e")).toBe("#0F766E");
    expect(brandHex("nope")).toBe(DEFAULT_BRAND_COLOR);
    expect(brandHex(undefined)).toBe(DEFAULT_BRAND_COLOR);
  });
});
