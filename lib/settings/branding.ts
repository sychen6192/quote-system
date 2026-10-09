// Branding image checks shared by the upload action and the Settings page.
// Pure and client-safe. PNG and JPEG only: react-pdf embeds both natively.

export const MAX_BRANDING_BYTES = 1024 * 1024;
export const MAX_BRANDING_DIMENSION = 8192;
// react-pdf decodes PNGs with alpha in JS on every render: a well-compressed
// 8192 × 8192 logo (under 300 KB) took 6.5 s and 1.2 GB per PDF, 2048 × 2048
// about 0.4 s. Printed logos and stamps never need more.
export const MAX_BRANDING_PIXELS = 2048 * 2048;
export const BRANDING_MIME_TYPES = ["image/png", "image/jpeg"] as const;
export type BrandingMime = (typeof BRANDING_MIME_TYPES)[number];

export type ImageInfo = { mime: BrandingMime; width: number; height: number };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** The image type by magic bytes, regardless of file name or claimed type. */
export function sniffImageMime(bytes: Uint8Array): BrandingMime | null {
  if (bytes.length >= 8 && PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  return null;
}

const u16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32 = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];

function pngSize(b: Uint8Array): { width: number; height: number } | null {
  // The first chunk must be IHDR (length 13): width and height at 16 / 20.
  const isIhdr = b.length >= 24 && u32(b, 8) === 13 && String.fromCharCode(b[12], b[13], b[14], b[15]) === "IHDR";
  return isIhdr ? { width: u32(b, 16), height: u32(b, 20) } : null;
}

function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i += 1; // fill byte
      continue;
    }
    // Standalone markers carry no length.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      i += 2;
      continue;
    }
    const length = u16(b, i + 2);
    if (length < 2) return null;
    // SOF0–SOF15 except DHT (C4), JPG (C8) and DAC (CC) hold the frame size.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: u16(b, i + 5), width: u16(b, i + 7) };
    }
    if (marker === 0xda) return null; // image data before any frame header
    i += 2 + length;
  }
  return null;
}

/** Type and pixel size of a PNG/JPEG, or null when it is neither or is damaged. */
export function inspectImage(bytes: Uint8Array): ImageInfo | null {
  const mime = sniffImageMime(bytes);
  if (!mime) return null;
  const size = mime === "image/png" ? pngSize(bytes) : jpegSize(bytes);
  if (!size) return null;
  const { width, height } = size;
  if (width < 1 || height < 1) return null;
  return { mime, width, height };
}

export type BrandingImageError = "imageTooLarge" | "unsupportedImage" | "imageDimensionsTooLarge";

/** Upload rules for logo / stamp / icon; errors are Validation message keys. */
export function validateBrandingImage(
  bytes: Uint8Array
): { ok: true; image: ImageInfo } | { ok: false; error: BrandingImageError } {
  if (bytes.length > MAX_BRANDING_BYTES) return { ok: false, error: "imageTooLarge" };
  const image = inspectImage(bytes);
  if (!image) return { ok: false, error: "unsupportedImage" };
  const { width, height } = image;
  if (
    width > MAX_BRANDING_DIMENSION ||
    height > MAX_BRANDING_DIMENSION ||
    width * height > MAX_BRANDING_PIXELS
  ) {
    return { ok: false, error: "imageDimensionsTooLarge" };
  }
  return { ok: true, image };
}
