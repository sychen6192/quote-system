import * as fs from "node:fs";
import * as path from "node:path";
import { deflateSync } from "node:zlib";
import {
  ICON_SPECS,
  MASKABLE_SAFE_RADIUS,
  farthestExtent,
  glyphDataUri,
  iconCacheControl,
  iconLayout,
  iconSpec,
  iconUrl,
  iconVersionToken,
  isFullBleedSource,
  pngHasAlpha,
  readPngSize,
} from "@/lib/pwa/icons";

const LOGO = fs.readFileSync(path.join(__dirname, "../../../branding-defaults/logo.png"));

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** A minimal valid PNG of the given size and colour type (pixels all zero). */
function png(width: number, height: number, colorType: number, extra: Buffer[] = []): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType] ?? 1;
  const raw = Buffer.alloc((width * channels + 1) * height);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    ...extra,
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("icon files", () => {
  it("knows exactly the published files", () => {
    expect(Object.keys(ICON_SPECS).sort()).toEqual(
      [
        "any-192.png",
        "any-512.png",
        "apple-180.png",
        "favicon-32.png",
        "maskable-192.png",
        "maskable-512.png",
        "shortcut-96.png",
        "shortcut-customers-96.png",
        "shortcut-new-96.png",
        "shortcut-quotes-96.png",
      ].sort()
    );
    expect(iconSpec("any-512.png")).toEqual({ kind: "brand", size: 512, treatment: "any" });
  });

  it("rejects unknown names, including inherited object keys", () => {
    expect(iconSpec("any-1024.png")).toBeNull();
    expect(iconSpec("constructor")).toBeNull();
    expect(iconSpec("__proto__")).toBeNull();
    expect(iconSpec("../any-192.png")).toBeNull();
  });

  it("has sizes that match the file names", () => {
    for (const [file, spec] of Object.entries(ICON_SPECS)) {
      expect(file).toContain(String(spec.size));
    }
  });
});

describe("PNG header parsing", () => {
  it("reads the IHDR size", () => {
    expect(readPngSize(LOGO)).toEqual({ width: 256, height: 256 });
    expect(readPngSize(png(300, 120, 2))).toEqual({ width: 300, height: 120 });
  });

  it("returns null for non-PNG data", () => {
    expect(readPngSize(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]))).toBeNull();
    expect(readPngSize(Buffer.alloc(0))).toBeNull();
  });

  it("detects alpha from the colour type or a tRNS chunk", () => {
    expect(pngHasAlpha(LOGO)).toBe(true); // RGBA
    expect(pngHasAlpha(png(4, 4, 6))).toBe(true);
    expect(pngHasAlpha(png(4, 4, 4))).toBe(true);
    expect(pngHasAlpha(png(4, 4, 2))).toBe(false);
    expect(pngHasAlpha(png(4, 4, 2, [chunk("tRNS", Buffer.from([0, 0, 0, 0, 0, 0]))]))).toBe(true);
    expect(pngHasAlpha(Buffer.from("not a png"))).toBe(false);
  });
});

describe("iconLayout", () => {
  const BRAND = "#1D4ED8";
  const sources = {
    squareAlpha: { width: 256, height: 256, alpha: true },
    wideAlpha: { width: 800, height: 200, alpha: true },
    tallAlpha: { width: 200, height: 600, alpha: true },
    squareOpaque: { width: 512, height: 512, alpha: false },
    wideOpaque: { width: 900, height: 300, alpha: false },
  };

  it("treats only square opaque images as finished app icons", () => {
    expect(isFullBleedSource(sources.squareOpaque)).toBe(true);
    expect(isFullBleedSource(sources.squareAlpha)).toBe(false);
    expect(isFullBleedSource(sources.wideOpaque)).toBe(false);
  });

  it.each(Object.entries(sources))("keeps the maskable logo and plate inside the safe zone (%s)", (_, source) => {
    for (const size of [192, 512]) {
      const layout = iconLayout(size, "maskable", source, BRAND);
      expect(layout.background).toBe(BRAND);
      expect(farthestExtent(layout.logo, size)).toBeLessThanOrEqual(MASKABLE_SAFE_RADIUS + 0.005);
      if (layout.plate) {
        expect(farthestExtent(layout.plate, size)).toBeLessThanOrEqual(MASKABLE_SAFE_RADIUS + 0.005);
      }
    }
  });

  it("uses the 0.55 safe-zone scale for the maskable logo", () => {
    const { logo } = iconLayout(512, "maskable", sources.squareAlpha, BRAND);
    expect(logo.width).toBeCloseTo(512 * 0.55, 1);
    expect(logo.x).toBeCloseTo((512 - logo.width) / 2, 1);
  });

  it("keeps the aspect ratio of wide and tall logos", () => {
    const wide = iconLayout(192, "any", sources.wideAlpha, BRAND).logo;
    expect(wide.width / wide.height).toBeCloseTo(4, 1);
    const tall = iconLayout(192, "any", sources.tallAlpha, BRAND).logo;
    expect(tall.height / tall.width).toBeCloseTo(3, 1);
  });

  it("puts transparent logos on a white tile for 'any' icons", () => {
    const layout = iconLayout(512, "any", sources.squareAlpha, BRAND);
    expect(layout.background).toBeNull();
    expect(layout.plate?.color).toBe("#ffffff");
    expect(layout.plate!.x).toBeGreaterThan(0);
    expect(layout.logo.width).toBeLessThan(layout.plate!.width);
  });

  it("shows a finished square icon edge to edge on the tile", () => {
    const layout = iconLayout(512, "any", sources.squareOpaque, BRAND);
    expect(layout.plate).toBeNull();
    expect(layout.logo.radius).toBeGreaterThan(0);
  });

  it("makes the Apple icon opaque white with the logo at 0.75", () => {
    const layout = iconLayout(180, "apple", sources.squareAlpha, BRAND);
    expect(layout.background).toBe("#ffffff");
    expect(layout.logo.width).toBeCloseTo(135, 1);
    expect(iconLayout(180, "apple", sources.squareOpaque, BRAND).logo).toEqual({
      x: 0,
      y: 0,
      width: 180,
      height: 180,
      radius: 0,
    });
  });
});

describe("icon URLs and caching", () => {
  it("caches versioned URLs forever, plain ones for an hour", () => {
    expect(iconCacheControl(true)).toBe("public, max-age=31536000, immutable");
    expect(iconCacheControl(false)).toBe("public, max-age=3600");
  });

  it("changes the version with the image and with the brand colour", () => {
    const a = iconVersionToken("abc123", "#1D4ED8");
    expect(iconVersionToken("abc123", "#1d4ed8")).toBe(a);
    expect(iconVersionToken("abc124", "#1D4ED8")).not.toBe(a);
    expect(iconVersionToken("abc123", "#0F766E")).not.toBe(a);
    expect(a).toMatch(/^[a-z0-9]+$/);
  });

  it("builds query-string versioned URLs", () => {
    expect(iconUrl("any-192.png", "v1")).toBe("/icons/any-192.png?v=v1");
  });

  it("encodes glyphs as SVG data URIs", () => {
    const uri = glyphDataUri("new");
    expect(uri).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(Buffer.from(uri.split(",")[1], "base64").toString()).toContain('stroke="#ffffff"');
  });
});
