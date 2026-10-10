import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { readPngSize } from "@/lib/pwa/icons";

const LOGO = fs.readFileSync(path.join(__dirname, "../../../branding-defaults/logo.png"));

const getBrandingAsset = jest.fn();
const getPublicConfig = jest.fn();

const UNDEFINED = "__undefined__";

type Plain = { type: string; props: Record<string, unknown> } | string | number | null | undefined;

function toPlain(node: unknown): Plain | Plain[] {
  if (Array.isArray(node)) return node.map(toPlain) as Plain[];
  if (!node || typeof node !== "object") return node as Plain;
  const el = node as { type: string; props: Record<string, unknown> };
  // JSON drops undefined; keep it visible to the renderer, which rejects it in styles.
  const style = el.props.style as Record<string, unknown> | undefined;
  const markedStyle = style
    ? Object.fromEntries(Object.entries(style).map(([k, v]) => [k, v === undefined ? UNDEFINED : v]))
    : undefined;
  return { type: el.type, props: { ...el.props, style: markedStyle, children: toPlain(el.props.children) } };
}

// The real renderer, in a child process (see fixtures/og-render.mjs).
jest.mock("next/og", () => ({
  ImageResponse: class {
    constructor(
      private element: unknown,
      private options: { width: number; height: number }
    ) {}
    async arrayBuffer() {
      const png = execFileSync(process.execPath, [path.join(__dirname, "fixtures/og-render.mjs")], {
        input: JSON.stringify({ element: toPlain(this.element), ...this.options }),
        maxBuffer: 16 * 1024 * 1024,
      });
      return png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength);
    }
  },
}));

jest.mock("@/services/settings", () => ({
  getBrandingAsset: (...args: unknown[]) => getBrandingAsset(...args),
  getPublicConfig: (...args: unknown[]) => getPublicConfig(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderIcon, renderVersionedIcon, getIconVersion } = require("@/lib/pwa/render-icon") as typeof import("@/lib/pwa/render-icon");

beforeEach(() => {
  getBrandingAsset.mockResolvedValue({ data: LOGO, mime: "image/png", version: "logo-v1" });
  getPublicConfig.mockResolvedValue({ brandColor: "#1D4ED8" });
});

describe("renderIcon", () => {
  it.each([
    ["any-192.png", 192],
    ["any-512.png", 512],
    ["maskable-192.png", 192],
    ["maskable-512.png", 512],
    ["apple-180.png", 180],
    ["favicon-32.png", 32],
    ["shortcut-96.png", 96],
    ["shortcut-new-96.png", 96],
    ["shortcut-quotes-96.png", 96],
    ["shortcut-customers-96.png", 96],
  ])("renders %s as a %i px PNG", async (file, size) => {
    const png = await renderIcon(file);
    expect(png).not.toBeNull();
    expect(readPngSize(png!)).toEqual({ width: size, height: size });
  }, 20_000);

  it("returns null for unknown files", async () => {
    expect(await renderIcon("any-1024.png")).toBeNull();
  });

  it("reuses a render for the same file and version", async () => {
    const a = await renderIcon("any-192.png");
    const b = await renderIcon("any-192.png");
    expect(b).toBe(a);
    getPublicConfig.mockResolvedValue({ brandColor: "#0F766E" });
    expect(await renderIcon("any-192.png")).not.toBe(a);
  });

  it("still renders without any branding image", async () => {
    getBrandingAsset.mockResolvedValue(null);
    const png = await renderIcon("maskable-512.png");
    expect(readPngSize(png!)).toEqual({ width: 512, height: 512 });
  }, 20_000);

  it("reports the getIconVersion() token of the image it drew", async () => {
    const branded = await renderVersionedIcon("apple-180.png");
    expect(branded!.version).toBe(await getIconVersion());
    expect(branded!.png).toBe(await renderIcon("apple-180.png"));
    // Database unreachable: the bundled default logo is drawn under another token.
    getBrandingAsset.mockResolvedValue({ data: LOGO, mime: "image/png", version: "default-logo" });
    const fallback = await renderVersionedIcon("apple-180.png");
    expect(fallback!.version).not.toBe(branded!.version);
    expect(fallback!.version).toBe(await getIconVersion());
    expect(await renderVersionedIcon("nope.png")).toBeNull();
  }, 20_000);

  it("versions icon URLs by image and brand colour", async () => {
    const v1 = await getIconVersion();
    getPublicConfig.mockResolvedValue({ brandColor: "#0F766E" });
    expect(await getIconVersion()).not.toBe(v1);
  });
});
