"use server";

import { getAppConfig } from "@/lib/config";
import { gcisUrl, parseGcisResponse, type VatCompany } from "@/lib/gcis";

export type VatLookupResult =
  | { ok: true; company: VatCompany }
  | { ok: false; reason: "DISABLED" | "INVALID" | "NOT_FOUND" | "ERROR" };

export async function lookupVatNumber(vat: string): Promise<VatLookupResult> {
  // Defence in depth: the button is hidden when the flag is off, but never
  // trust the client.
  if (!getAppConfig().features.twVatLookup) {
    return { ok: false, reason: "DISABLED" };
  }

  const trimmed = (vat ?? "").trim();
  if (!/^\d{8}$/.test(trimmed)) {
    return { ok: false, reason: "INVALID" };
  }

  try {
    const res = await fetch(gcisUrl(trimmed), {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { ok: false, reason: "ERROR" };

    const company = parseGcisResponse(await res.json());
    if (!company) return { ok: false, reason: "NOT_FOUND" };

    return { ok: true, company };
  } catch (err) {
    console.error("lookupVatNumber failed:", err);
    return { ok: false, reason: "ERROR" };
  }
}
