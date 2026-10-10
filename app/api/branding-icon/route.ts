import { brandingResponse } from "@/lib/settings/branding-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kept for existing links/bookmarks: same as /api/branding/icon. */
export async function GET(req: Request) {
  return brandingResponse(req, "icon");
}
