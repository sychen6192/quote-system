import { NextResponse } from "next/server";
import { getBrandingFile } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const icon = getBrandingFile("icon");
  if (!icon) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(new Uint8Array(icon), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
