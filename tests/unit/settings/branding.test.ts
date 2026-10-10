import * as fs from "node:fs";
import * as path from "node:path";
import {
  inspectImage,
  MAX_BRANDING_BYTES,
  MAX_BRANDING_DIMENSION,
  MAX_BRANDING_PIXELS,
  sniffImageMime,
  validateBrandingImage,
} from "@/lib/settings/branding";

// 1x1 transparent PNG
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

// Smallest useful JPEG header: SOI, APP0 (JFIF), SOF0 (3x2), then EOI.
const TINY_JPEG = Buffer.from([
  0xff, 0xd8,
  0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x02, 0x00, 0x03, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
  0xff, 0xd9,
]);

function pngWithSize(width: number, height: number): Buffer {
  const png = Buffer.from(TINY_PNG);
  png.writeUInt32BE(width, 16);
  png.writeUInt32BE(height, 20);
  return png;
}

describe("sniffImageMime", () => {
  it.each<[string, Uint8Array, string | null]>([
    ["PNG", TINY_PNG, "image/png"],
    ["JPEG", TINY_JPEG, "image/jpeg"],
    ["GIF", Buffer.from("GIF89a\x01\x00\x01\x00", "binary"), null],
    ["WebP", Buffer.from("RIFF\x00\x00\x00\x00WEBPVP8 ", "binary"), null],
    ["SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), null],
    ["PNG signature cut short", TINY_PNG.subarray(0, 7), null],
    ["empty", new Uint8Array(), null],
    ["text renamed .png", Buffer.from("hello world"), null],
  ])("%s → %p", (_label, bytes, expected) => {
    expect(sniffImageMime(bytes)).toBe(expected);
  });
});

describe("inspectImage", () => {
  it("reads PNG dimensions from IHDR", () => {
    expect(inspectImage(TINY_PNG)).toEqual({ mime: "image/png", width: 1, height: 1 });
    expect(inspectImage(pngWithSize(512, 256))).toEqual({ mime: "image/png", width: 512, height: 256 });
  });

  it("reads JPEG dimensions from the SOF segment", () => {
    expect(inspectImage(TINY_JPEG)).toEqual({ mime: "image/jpeg", width: 3, height: 2 });
  });

  it("reads the committed default logo", () => {
    const logo = fs.readFileSync(path.join(process.cwd(), "branding-defaults", "logo.png"));
    expect(inspectImage(logo)).toMatchObject({ mime: "image/png" });
  });

  it.each<[string, Uint8Array]>([
    ["PNG without IHDR", Buffer.concat([TINY_PNG.subarray(0, 8), Buffer.from("garbage-garbage-garbage")])],
    ["PNG of zero width", pngWithSize(0, 10)],
    ["JPEG with only SOI", Buffer.from([0xff, 0xd8, 0xff, 0xd9])],
    ["JPEG with scan data before SOF", Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])],
    ["JPEG with a broken segment", Buffer.from([0xff, 0xd8, 0x12, 0x34, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])],
    ["not an image", Buffer.from("not an image at all")],
  ])("rejects %s", (_label, bytes) => {
    expect(inspectImage(bytes)).toBeNull();
  });
});

describe("validateBrandingImage", () => {
  it.each<[string, Uint8Array, string | null]>([
    ["a small PNG", TINY_PNG, null],
    ["a small JPEG", TINY_JPEG, null],
    ["2048 × 2048", pngWithSize(2048, 2048), null],
    // Wide logos are fine: the cost is in the pixel count.
    ["4000 × 1000", pngWithSize(4000, 1000), null],
    // react-pdf decodes PNGs with alpha in JS: 8192² took 6.5 s and 1.2 GB
    // per PDF; the error must say what is wrong, not "unsupported".
    ["2049 × 2048", pngWithSize(2049, 2048), "imageDimensionsTooLarge"],
    ["8192 × 8192", pngWithSize(8192, 8192), "imageDimensionsTooLarge"],
    ["a side over the limit", pngWithSize(MAX_BRANDING_DIMENSION + 1, 10), "imageDimensionsTooLarge"],
    ["over 1 MB", Buffer.concat([TINY_PNG, Buffer.alloc(MAX_BRANDING_BYTES)]), "imageTooLarge"],
    ["GIF", Buffer.from("GIF89a\x01\x00\x01\x00", "binary"), "unsupportedImage"],
    ["damaged PNG", pngWithSize(0, 0), "unsupportedImage"],
  ])("%s → %p", (_label, bytes, expected) => {
    const result = validateBrandingImage(bytes);
    expect(result.ok ? null : result.error).toBe(expected);
  });

  it("returns the image info when valid", () => {
    expect(validateBrandingImage(pngWithSize(300, 100))).toEqual({
      ok: true,
      image: { mime: "image/png", width: 300, height: 100 },
    });
  });

  it("allows about 4 megapixels", () => {
    expect(MAX_BRANDING_PIXELS).toBe(2048 * 2048);
  });
});
