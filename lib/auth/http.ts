import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, type AppLocale } from "@/i18n/locales";
import { isAppLocale, localeFromPath } from "./paths";

/**
 * 303 with a relative Location: the browser resolves it against the URL it
 * actually used, so it stays correct behind any reverse proxy.
 */
export function seeOther(location: string, headers?: Record<string, string>): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: location, "Cache-Control": "no-store", ...headers },
  });
}

export function jsonError(code: string, status: number): NextResponse {
  return NextResponse.json({ error: code }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Form body, or an empty one when the body is missing or not a form. */
export async function readForm(req: Request): Promise<FormData> {
  try {
    return await req.formData();
  } catch {
    return new FormData();
  }
}

export function formString(form: FormData, name: string): string {
  const v = form.get(name);
  return typeof v === "string" ? v : "";
}

export function isHttpsRequest(req: NextRequest): boolean {
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  return proto === "https" || req.nextUrl.protocol === "https:";
}

/** Form field → path of `fromPath` → NEXT_LOCALE cookie → default. */
export function requestLocale(req: NextRequest, formLocale: string, fromPath?: string): AppLocale {
  if (isAppLocale(formLocale)) return formLocale;
  const pathLocale = fromPath ? localeFromPath(fromPath) : null;
  if (pathLocale) return pathLocale;
  const cookie = req.cookies.get("NEXT_LOCALE")?.value;
  return isAppLocale(cookie) ? cookie : DEFAULT_LOCALE;
}
