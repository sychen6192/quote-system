// Brand colour presets and branding-image checks for the Settings page.
// Pure and client-safe.
import { brandPalette, DEFAULT_BRAND_COLOR, type BrandTokens } from "@/lib/brand-color";
import { validateBrandingImage, type BrandingImageError } from "@/lib/settings/branding";
import type { BrandingKind } from "@/lib/settings/types";

export const BRAND_PRESETS = [
  { key: "navy", hex: "#1E3A8A" },
  { key: "blue", hex: "#1D4ED8" },
  { key: "indigo", hex: "#4F46E5" },
  { key: "teal", hex: "#0F766E" },
  { key: "emerald", hex: "#047857" },
  { key: "crimson", hex: "#B91C1C" },
  { key: "orange", hex: "#C2410C" },
  { key: "slate", hex: "#334155" },
] as const;

export type BrandPresetKey = (typeof BRAND_PRESETS)[number]["key"];

/** "1d4ed8" / "#1d4ed8" / "#1D4ED8 " → "#1D4ED8"; also expands "#abc". Else null. */
export function normalizeHex(input: string): string | null {
  let value = input.trim();
  if (!value.startsWith("#")) value = `#${value}`;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    value = `#${[...value.slice(1)].map((c) => c + c).join("")}`;
  }
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : null;
}

export function presetForHex(hex: string): BrandPresetKey | null {
  const upper = hex.toUpperCase();
  return BRAND_PRESETS.find((preset) => preset.hex === upper)?.key ?? null;
}

// globals.css's hand-tuned palette for the default colour (brandPalette
// returns null for it). Needed so a preview can show the default while the
// page itself runs on another saved brand colour.
const DEFAULT_TOKENS: { light: BrandTokens; dark: BrandTokens } = {
  light: {
    primary: "224 76% 48%",
    "primary-foreground": "0 0% 100%",
    ring: "224 76% 48%",
    accent: "214 100% 97%",
    "accent-foreground": "226 71% 40%",
    "chart-1": "224 76% 48%",
  },
  dark: {
    primary: "217 91% 62%",
    "primary-foreground": "222 47% 7%",
    ring: "217 91% 62%",
    accent: "217 33% 24%",
    "accent-foreground": "210 40% 96%",
    "chart-1": "217 91% 62%",
  },
};

/** CSS custom properties that re-theme a subtree to `hex` (null if invalid). */
export function brandPreviewVars(
  hex: string,
  mode: "light" | "dark"
): Record<string, string> | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const palette =
    normalized === DEFAULT_BRAND_COLOR ? DEFAULT_TOKENS : brandPalette(normalized);
  if (!palette) return null;
  return Object.fromEntries(
    Object.entries(palette[mode]).map(([name, value]) => [`--${name}`, value])
  );
}

export type ImageWarning = "notSquare" | "small";

export type ImageCheck =
  | { ok: true; width: number; height: number; warnings: ImageWarning[] }
  | { ok: false; error: BrandingImageError };

// Below these the image looks soft on a 2× screen or in print.
const MIN_SIZE: Record<BrandingKind, number> = { logo: 300, stamp: 300, icon: 512 };

/**
 * The upload action's own checks (type by magic bytes, ≤ 1 MB, pixel limit)
 * run before uploading, plus advice that does not block the upload.
 */
export function checkBrandingImage(kind: BrandingKind, bytes: Uint8Array): ImageCheck {
  const result = validateBrandingImage(bytes);
  if (!result.ok) return result;
  const { width, height } = result.image;
  const warnings: ImageWarning[] = [];
  if (kind === "icon" && width !== height) warnings.push("notSquare");
  if (Math.max(width, height) < MIN_SIZE[kind]) warnings.push("small");
  return { ok: true, width, height, warnings };
}
