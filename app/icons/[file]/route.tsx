import { iconCacheControl } from "@/lib/pwa/icons";
import { renderVersionedIcon } from "@/lib/pwa/render-icon";

// next/og renders with resvg/yoga WASM under Node: no sharp needed.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PWA icons drawn from the branding icon (lib/pwa/icons.ts lists the files). Public. */
export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const icon = await renderVersionedIcon(file);
  if (!icon) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const { png, version } = icon;
  return new Response(png as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(png.byteLength),
      "Cache-Control": iconCacheControl(new URL(req.url).searchParams.get("v"), version),
    },
  });
}
