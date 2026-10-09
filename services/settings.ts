// PLACEHOLDER (env-only) — replaced by the real DB-backed implementation (Wave A3).
// The exported signatures ARE the contract; keep them.
import "server-only";
import { getAppConfig, getBrandingFile } from "@/lib/config";
import type {
  BrandingAsset,
  BrandingKind,
  DocumentBranding,
  EffectiveSettings,
  PublicAppConfig,
} from "@/lib/settings/types";

export async function getSettings(): Promise<EffectiveSettings> {
  const c = getAppConfig();
  return {
    company: { ...c.company, website: "" },
    payment: c.payment ? { ...c.payment, bankCode: "" } : null,
    quote: {
      numberPattern: "QT-{YYYY}{MM}{DD}-{SEQ:3}",
      validityDays: 30,
      defaultTaxRate: c.money.defaultTaxRate,
      defaultNotes: "",
      defaultTerms: "",
      defaultSalesperson: "",
      showAmountInWords: c.money.currency === "TWD",
      footerText: "",
    },
    money: {
      currency: c.money.currency,
      currencyLocale: c.money.currencyLocale,
      fractionDigits: 0,
    },
    appearance: { brandColor: "#1D4ED8" },
    region: { timezone: process.env.APP_TIMEZONE || "Asia/Taipei" },
    mail: { ...c.mail, replyTo: "" },
    features: c.features,
    auth: { enabled: Boolean(process.env.APP_PASSWORD) },
    version: "0",
  };
}

export async function getPublicConfig(): Promise<PublicAppConfig> {
  const s = await getSettings();
  return {
    companyName: s.company.name,
    companyNameLocal: s.company.nameLocal,
    isDefaultCompany: s.company.isDefault,
    currency: s.money.currency,
    currencyLocale: s.money.currencyLocale,
    fractionDigits: s.money.fractionDigits,
    defaultTaxRate: s.quote.defaultTaxRate,
    validityDays: s.quote.validityDays,
    defaultSalesperson: s.quote.defaultSalesperson,
    showAmountInWords: s.quote.showAmountInWords,
    timezone: s.region.timezone,
    brandColor: s.appearance.brandColor,
    twVatLookup: s.features.twVatLookup,
    mailEnabled: s.mail.enabled,
    authEnabled: s.auth.enabled,
    logoUrl: `/api/branding/logo?v=${s.version}`,
    iconUrl: `/api/branding/icon?v=${s.version}`,
    version: s.version,
  };
}

export async function getBrandingAsset(
  kind: BrandingKind
): Promise<BrandingAsset | null> {
  const data = getBrandingFile(kind);
  return data ? { data, mime: "image/png", version: "0" } : null;
}

export async function getDocumentBranding(
  mode: "html" | "pdf"
): Promise<DocumentBranding> {
  const s = await getSettings();
  const toSrc = async (kind: BrandingKind) => {
    const asset = await getBrandingAsset(kind);
    if (!asset) return null;
    return mode === "pdf"
      ? `data:${asset.mime};base64,${asset.data.toString("base64")}`
      : `/api/branding/${kind}?v=${asset.version}`;
  };
  return {
    company: s.company,
    payment: s.payment,
    logoSrc: (await toSrc("logo")) ?? "",
    stampSrc: await toSrc("stamp"),
    brandColor: s.appearance.brandColor,
    currency: s.money.currency,
    currencyLocale: s.money.currencyLocale,
    fractionDigits: s.money.fractionDigits,
    showAmountInWords: s.quote.showAmountInWords,
    footerText: s.quote.footerText,
    timezone: s.region.timezone,
  };
}

/** Drop in-process caches after a settings/branding write. */
export function invalidateSettingsCache(): void {}
