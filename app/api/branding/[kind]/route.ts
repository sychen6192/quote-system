import { brandingResponse } from "@/lib/settings/branding-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** logo | stamp | icon; `?v=<version>` → immutable. Public (no auth). */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ kind: string }> }
) {
  const { kind } = await params;
  return brandingResponse(req, kind);
}
