import "server-only";
import type { ReactElement } from "react";
import { ImageResponse } from "next/og";
import { brandHex } from "@/lib/brand-color";
import { inspectImage, sniffImageMime } from "@/lib/settings/branding";
import type { BrandingAsset } from "@/lib/settings/types";
import { getBrandingAsset, getPublicConfig } from "@/services/settings";
import {
  glyphDataUri,
  iconLayout,
  iconSpec,
  iconVersionToken,
  isFullBleedSource,
  pngHasAlpha,
  type IconFile,
  type IconSpec,
  type SourceImage,
} from "./icons";

type Source = { asset: BrandingAsset; image: SourceImage; dataUri: string };

/** Renders take 20–400 ms (resvg in WASM); results are reused per file + icon version. */
const MEMO_LIMIT = 32;
const memo = new Map<string, Promise<Uint8Array>>();

function remember(key: string, render: () => Promise<Uint8Array>): Promise<Uint8Array> {
  const hit = memo.get(key);
  if (hit) return hit;
  const promise = render();
  memo.set(key, promise);
  promise.catch(() => memo.delete(key));
  while (memo.size > MEMO_LIMIT) memo.delete(memo.keys().next().value as string);
  return promise;
}

function describe(asset: BrandingAsset): Source {
  const mime = sniffImageMime(asset.data) ?? asset.mime;
  const info = inspectImage(asset.data);
  return {
    asset,
    image: {
      width: info?.width ?? 1,
      height: info?.height ?? 1,
      alpha: mime === "image/png" ? pngHasAlpha(asset.data) : false,
    },
    dataUri: `data:${mime};base64,${asset.data.toString("base64")}`,
  };
}

async function loadSource(): Promise<{ source: Source | null; brandColor: string }> {
  const [asset, config] = await Promise.all([getBrandingAsset("icon"), getPublicConfig()]);
  return { source: asset ? describe(asset) : null, brandColor: brandHex(config.brandColor) };
}

/** The `?v=` token for icon URLs: changes with the icon image and the brand colour. */
export async function getIconVersion(): Promise<string> {
  const [asset, config] = await Promise.all([getBrandingAsset("icon"), getPublicConfig()]);
  return iconVersionToken(asset?.version ?? "none", brandHex(config.brandColor));
}

async function toPng(element: ReactElement, size: number): Promise<Uint8Array> {
  const response = new ImageResponse(element, { width: size, height: size });
  return new Uint8Array(await response.arrayBuffer());
}

function glyphElement(spec: Extract<IconSpec, { kind: "glyph" }>, brandColor: string) {
  const { size } = spec;
  const glyph = Math.round(size * 0.5);
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: brandColor,
        borderRadius: Math.round(size * 0.22),
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- ImageResponse markup, not a page */}
      <img src={glyphDataUri(spec.glyph)} width={glyph} height={glyph} />
    </div>
  );
}

function brandElement(spec: Extract<IconSpec, { kind: "brand" }>, source: Source, brandColor: string) {
  const layout = iconLayout(spec.size, spec.treatment, source.image, brandColor);
  const { plate, logo } = layout;
  const hairline = spec.treatment === "any" && plate ? Math.max(1, Math.round(spec.size / 192)) : 0;
  return (
    <div
      style={{
        width: layout.size,
        height: layout.size,
        display: "flex",
        position: "relative",
        background: layout.background ?? "transparent",
      }}
    >
      {plate ? (
        <div
          style={{
            position: "absolute",
            left: plate.x,
            top: plate.y,
            width: plate.width,
            height: plate.height,
            borderRadius: plate.radius,
            background: plate.color,
            // Satori chokes on undefined style values: leave the key out instead.
            ...(hairline ? { border: `${hairline}px solid rgba(15, 23, 42, 0.08)` } : {}),
          }}
        />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- ImageResponse markup, not a page */}
      <img
        src={source.dataUri}
        width={logo.width}
        height={logo.height}
        style={{
          position: "absolute",
          left: logo.x,
          top: logo.y,
          width: logo.width,
          height: logo.height,
          borderRadius: logo.radius,
          objectFit: isFullBleedSource(source.image) ? "cover" : "contain",
        }}
      />
    </div>
  );
}

/**
 * The PNG for /icons/<file>, or null for an unknown file name. Without any
 * branding image (not even the bundled default) the brand icons fall back to
 * the quotes glyph on the brand colour, so installing never breaks.
 */
export async function renderIcon(file: string): Promise<Uint8Array | null> {
  const spec = iconSpec(file);
  if (!spec) return null;
  const { source, brandColor } = await loadSource();
  const version = source?.asset.version ?? "none";
  return remember(`${file as IconFile}:${version}:${brandColor}`, () => {
    if (spec.kind === "glyph") return toPng(glyphElement(spec, brandColor), spec.size);
    if (!source) {
      return toPng(glyphElement({ kind: "glyph", size: spec.size, glyph: "quotes" }, brandColor), spec.size);
    }
    return toPng(brandElement(spec, source, brandColor), spec.size);
  });
}

/** The icon as a data URI (for pages that must work offline). */
export async function iconDataUri(file: IconFile): Promise<string | null> {
  const png = await renderIcon(file);
  return png ? `data:image/png;base64,${Buffer.from(png).toString("base64")}` : null;
}
