"use server";

import { headers } from "next/headers";
import { gcisUrl, parseGcisResponse, type VatCompany } from "@/lib/gcis";
import { checkAll, createRateLimiter, getClientIp } from "@/lib/server/rate-limit";
import { getSettings } from "@/services/settings";
import { requireAuth } from "./types";

export type VatLookupResult =
  | { success: true; company: VatCompany }
  | {
      success: false;
      code: "DISABLED" | "INVALID" | "NOT_FOUND" | "ERROR" | "UNAUTHORIZED" | "RATE_LIMITED";
    };

// The government API is shared and unauthenticated; don't let one client
// hammer it through us. The per-address key is spoofable (X-Forwarded-For),
// so a shared cap bounds the total.
const limiter = createRateLimiter({ windowMs: 60_000, max: 30 });
const overallLimiter = createRateLimiter({ windowMs: 60_000, max: 60, maxKeys: 1 });

export async function lookupVatNumber(vat: unknown): Promise<VatLookupResult> {
  if (await requireAuth()) return { success: false, code: "UNAUTHORIZED" };

  // Defence in depth: the button is hidden when the flag is off, but never
  // trust the client.
  let enabled: boolean;
  try {
    enabled = (await getSettings()).features.twVatLookup;
  } catch (err) {
    console.error("lookupVatNumber: could not load settings:", err);
    return { success: false, code: "ERROR" };
  }
  if (!enabled) return { success: false, code: "DISABLED" };

  const trimmed = typeof vat === "string" ? vat.trim() : "";
  if (!/^\d{8}$/.test(trimmed)) return { success: false, code: "INVALID" };

  const ip = getClientIp(await headers());
  if (!checkAll([[limiter, ip], [overallLimiter, "*"]]).ok) {
    return { success: false, code: "RATE_LIMITED" };
  }

  try {
    const res = await fetch(gcisUrl(trimmed), {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { success: false, code: "ERROR" };

    const company = parseGcisResponse(await res.json());
    if (!company) return { success: false, code: "NOT_FOUND" };

    return { success: true, company };
  } catch (err) {
    console.error("lookupVatNumber failed:", err);
    return { success: false, code: "ERROR" };
  }
}
