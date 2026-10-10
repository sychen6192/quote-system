// PWA icon files rendered at runtime from the branding icon (spec §9). Pure:
// the route (app/icons/[file]/route.tsx) turns an IconLayout into JSX.

export type IconFile =
  | "any-192.png"
  | "any-512.png"
  | "maskable-192.png"
  | "maskable-512.png"
  | "apple-180.png"
  | "favicon-32.png"
  | "shortcut-96.png"
  | "shortcut-new-96.png"
  | "shortcut-quotes-96.png"
  | "shortcut-customers-96.png";

export type ShortcutGlyph = "new" | "quotes" | "customers";

type Treatment = "any" | "favicon" | "maskable" | "apple";

export type IconSpec =
  | { kind: "brand"; size: number; treatment: Treatment }
  | { kind: "glyph"; size: number; glyph: ShortcutGlyph };

export const ICON_SPECS: Readonly<Record<IconFile, IconSpec>> = {
  "any-192.png": { kind: "brand", size: 192, treatment: "any" },
  "any-512.png": { kind: "brand", size: 512, treatment: "any" },
  "maskable-192.png": { kind: "brand", size: 192, treatment: "maskable" },
  "maskable-512.png": { kind: "brand", size: 512, treatment: "maskable" },
  "apple-180.png": { kind: "brand", size: 180, treatment: "apple" },
  "favicon-32.png": { kind: "brand", size: 32, treatment: "favicon" },
  "shortcut-96.png": { kind: "brand", size: 96, treatment: "any" },
  "shortcut-new-96.png": { kind: "glyph", size: 96, glyph: "new" },
  "shortcut-quotes-96.png": { kind: "glyph", size: 96, glyph: "quotes" },
  "shortcut-customers-96.png": { kind: "glyph", size: 96, glyph: "customers" },
};

export function iconSpec(file: string): IconSpec | null {
  return Object.prototype.hasOwnProperty.call(ICON_SPECS, file) ? ICON_SPECS[file as IconFile] : null;
}

/** Maskable icons: everything must sit inside the centred circle of radius 0.4 (W3C icon masks). */
export const MASKABLE_SAFE_RADIUS = 0.4;
/** A square logo of this size has its corners on the safe circle (0.55/√2 ≈ 0.389). */
export const MASKABLE_LOGO_SCALE = 0.55;

export type SourceImage = {
  width: number;
  height: number;
  /** PNG with an alpha channel or tRNS chunk. JPEG never has one. */
  alpha: boolean;
};

/** A square, opaque source is a finished app icon: show it edge to edge instead of on a tile. */
export function isFullBleedSource(source: SourceImage): boolean {
  if (source.alpha || source.width < 1 || source.height < 1) return false;
  return Math.abs(source.width / source.height - 1) <= 0.05;
}

export type Box = { x: number; y: number; width: number; height: number; radius: number };

export type IconLayout = {
  size: number;
  /** Full-canvas background; null = transparent. */
  background: string | null;
  /** Rounded plate behind the logo; null = none. */
  plate: (Box & { color: string }) | null;
  logo: Box;
};

const round = (n: number) => Math.round(n * 100) / 100;

/** The largest box of the source's aspect ratio that fits in `max` × `max`, centred on the canvas. */
function fit(size: number, max: number, source: SourceImage, radius = 0): Box {
  const ratio = source.width > 0 && source.height > 0 ? source.width / source.height : 1;
  const width = ratio >= 1 ? max : max * ratio;
  const height = ratio >= 1 ? max / ratio : max;
  return {
    x: round((size - width) / 2),
    y: round((size - height) / 2),
    width: round(width),
    height: round(height),
    radius: round(radius),
  };
}

function square(size: number, side: number, radius: number): Box {
  const offset = round((size - side) / 2);
  return { x: offset, y: offset, width: round(side), height: round(side), radius: round(radius) };
}

const WHITE = "#ffffff";

/**
 * Where the branding image goes on each canvas.
 * - any / shortcut / favicon: a white rounded tile (as in the top bar), so dark
 *   logos stay visible on dark docks and taskbars.
 * - maskable: brand-colour background, logo at the 0.55 safe-zone scale on a
 *   white plate whose corners stay inside the safe circle.
 * - apple: opaque white (iOS fills transparency with black), logo at 0.75.
 */
export function iconLayout(
  size: number,
  treatment: Treatment,
  source: SourceImage,
  brandColor: string
): IconLayout {
  const fullBleed = isFullBleedSource(source);
  switch (treatment) {
    case "any":
    case "favicon": {
      const inset = treatment === "favicon" ? 0 : 0.04;
      const tileSide = size * (1 - inset * 2);
      const tileRadius = tileSide * (treatment === "favicon" ? 0.2 : 0.22);
      if (fullBleed) {
        return { size, background: null, plate: null, logo: square(size, tileSide, tileRadius) };
      }
      return {
        size,
        background: null,
        plate: { ...square(size, tileSide, tileRadius), color: WHITE },
        logo: fit(size, size * (treatment === "favicon" ? 0.8 : 0.7), source),
      };
    }
    case "maskable": {
      const logoSide = size * MASKABLE_LOGO_SCALE;
      if (fullBleed) {
        return {
          size,
          background: brandColor,
          plate: null,
          logo: square(size, logoSide, logoSide * 0.18),
        };
      }
      // Side 0.64 with corner radius 0.17 puts the plate's farthest point at
      // (0.32 − 0.17)·√2 + 0.17 ≈ 0.38 from the centre, just inside the safe circle.
      return {
        size,
        background: brandColor,
        plate: { ...square(size, size * 0.64, size * 0.17), color: WHITE },
        logo: fit(size, logoSide, source),
      };
    }
    case "apple":
      return {
        size,
        background: WHITE,
        plate: null,
        logo: fullBleed ? square(size, size, 0) : fit(size, size * 0.75, source),
      };
  }
}

/** Farthest point of a (rounded) box from the canvas centre, as a fraction of the canvas. */
export function farthestExtent(box: Box, size: number): number {
  const c = size / 2;
  const dx = Math.max(Math.abs(box.x - c), Math.abs(box.x + box.width - c));
  const dy = Math.max(Math.abs(box.y - c), Math.abs(box.y + box.height - c));
  const r = Math.min(box.radius, box.width / 2, box.height / 2);
  const cornerX = dx - r;
  const cornerY = dy - r;
  return (Math.hypot(cornerX, cornerY) + r) / size;
}

// Glyphs from Lucide (https://lucide.dev, ISC License): the app's own nav icons.
const GLYPH_PATHS: Record<ShortcutGlyph, string> = {
  new:
    '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M9 15h6"/><path d="M12 18v-6"/>',
  quotes:
    '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  customers:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
};

/** A white Lucide glyph as an SVG data URI (for an <img> in ImageResponse). */
export function glyphDataUri(glyph: ShortcutGlyph, color = WHITE): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" ` +
    `stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${GLYPH_PATHS[glyph]}</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

const u32 = (b: Uint8Array, i: number) =>
  ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(b: Uint8Array): boolean {
  return b.length >= 33 && PNG_SIGNATURE.every((v, i) => b[i] === v);
}

/** Width/height from a PNG's IHDR chunk, or null when it is not a PNG. */
export function readPngSize(b: Uint8Array): { width: number; height: number } | null {
  if (!isPng(b)) return null;
  const type = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (u32(b, 8) !== 13 || type !== "IHDR") return null;
  return { width: u32(b, 16), height: u32(b, 20) };
}

/**
 * Whether a PNG can hold transparency: colour type 4/6 (grey/RGB + alpha), or
 * a tRNS chunk before the image data. Does not decode pixels, so a fully
 * opaque RGBA file still counts as "alpha" (it then gets the tile treatment).
 */
export function pngHasAlpha(b: Uint8Array): boolean {
  if (!readPngSize(b)) return false;
  const colorType = b[25];
  if (colorType === 4 || colorType === 6) return true;
  let i = 8;
  while (i + 8 <= b.length) {
    const length = u32(b, i);
    const type = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
    if (type === "tRNS") return true;
    if (type === "IDAT" || type === "IEND") return false;
    i += 12 + length;
  }
  return false;
}

/**
 * Cache-Control for an icon. A `?v=` URL is cached forever only when `v` is
 * the token of the image actually drawn (`current`): while the database is
 * unreachable the default logo is drawn, but pages may still link the
 * branded version, and pinning the placeholder there would stick for a year.
 */
export function iconCacheControl(requested: string | null, current: string): string {
  if (requested === null) return "public, max-age=3600";
  return requested === current ? "public, max-age=31536000, immutable" : "public, max-age=300";
}

/**
 * The `?v=` token for icon URLs. Maskable and shortcut icons are drawn on the
 * brand colour, so it is part of the token: Chrome only refreshes an installed
 * app's icons when their URLs change.
 */
export function iconVersionToken(assetVersion: string, brandColor: string): string {
  const input = `${assetVersion}|${brandColor.toUpperCase()}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${assetVersion.slice(0, 10)}${(h >>> 0).toString(36)}`;
}

export function iconUrl(file: IconFile, version: string): string {
  return `/icons/${file}?v=${encodeURIComponent(version)}`;
}
