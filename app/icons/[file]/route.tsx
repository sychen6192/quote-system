import { iconCacheControl } from "@/lib/pwa/icons";
import { renderIcon } from "@/lib/pwa/render-icon";

// next/og renders with resvg/yoga WASM under Node: no sharp needed.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PWA icons drawn from the branding icon (lib/pwa/icons.ts lists the files). Public. */
export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const png = await renderIcon(file);
  if (!png) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const versioned = new URL(req.url).searchParams.has("v");
  return new Response(png as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(png.byteLength),
      "Cache-Control": iconCacheControl(versioned),
    },
  });
}
