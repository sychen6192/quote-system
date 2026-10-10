import type { NextRequest } from "next/server";
import { formString, isHttpsRequest, jsonError, readForm, requestLocale, seeOther } from "@/lib/auth/http";
import { isSameOrigin } from "@/lib/auth/origin";
import { SESSION_COOKIE, authEnabled, sessionCookieOptions } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function refererPath(req: NextRequest): string | undefined {
  const referer = req.headers.get("referer");
  if (!referer) return undefined;
  try {
    return new URL(referer).pathname;
  } catch {
    return undefined;
  }
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req.headers)) return jsonError("CROSS_ORIGIN", 403);

  const form = await readForm(req);
  const locale = requestLocale(req, formString(form, "locale"), refererPath(req));

  const res = seeOther(authEnabled() ? `/${locale}/login` : `/${locale}`);
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(isHttpsRequest(req)), maxAge: 0 });
  return res;
}
