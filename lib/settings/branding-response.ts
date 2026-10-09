// HTTP response for /api/branding/[kind] and its /api/branding-icon alias.
// The logo and icon are public by design (login page, manifest, emails).
import "server-only";
import { isAuthenticated } from "@/lib/auth/guard";
import { getBrandingAsset, getSettings } from "@/services/settings";
import { isBrandingKind } from "./schema";

export const BRANDING_IMMUTABLE = "public, max-age=31536000, immutable";
export const BRANDING_SHORT_CACHE = "public, max-age=300";
export const BRANDING_PRIVATE_IMMUTABLE = "private, max-age=31536000, immutable";
export const BRANDING_PRIVATE_SHORT_CACHE = "private, max-age=300";

const NO_STORE = { "Cache-Control": "no-store" };

function etagMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  return header
    .split(",")
    .map((tag) => tag.trim().replace(/^W\//, ""))
    .some((tag) => tag === "*" || tag === etag);
}

export async function brandingResponse(req: Request, kind: string): Promise<Response> {
  if (!isBrandingKind(kind)) return new Response(null, { status: 404, headers: NO_STORE });

  // The company seal (印章) is only shown inside the app and in PDFs; a
  // public copy would make forging documents easy.
  const isPrivate = kind === "stamp";
  if (isPrivate && !(await isAuthenticated())) {
    return new Response(null, { status: 401, headers: NO_STORE });
  }

  const v = new URL(req.url).searchParams.get("v");
  // Settings first: getBrandingAsset then reads bytes no older than this
  // version, so a matching ?v= can safely be cached forever.
  const settingsVersion = v !== null ? (await getSettings()).version : null;
  const asset = await getBrandingAsset(kind);
  if (!asset) return new Response(null, { status: 404, headers: NO_STORE });

  const etag = `"${asset.version}"`;
  // Only a current version may be cached forever: a stale process (or an
  // old page) asking for a new ?v= must not pin outdated bytes to that URL.
  const immutable = v !== null && (v === settingsVersion || v === asset.version);
  const cacheControl = isPrivate
    ? immutable
      ? BRANDING_PRIVATE_IMMUTABLE
      : BRANDING_PRIVATE_SHORT_CACHE
    : immutable
      ? BRANDING_IMMUTABLE
      : BRANDING_SHORT_CACHE;

  const headers: Record<string, string> = { ETag: etag, "Cache-Control": cacheControl };
  if (etagMatches(req.headers.get("if-none-match"), etag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(new Uint8Array(asset.data), {
    headers: {
      ...headers,
      "Content-Type": asset.mime,
      "Content-Length": String(asset.data.length),
    },
  });
}
