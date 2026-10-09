import * as fs from "node:fs";
import * as path from "node:path";
import { authEnabled } from "@/lib/auth/session";
import {
  SETTINGS_DEFAULTS,
  mergeSettings,
  type EnvSettings,
} from "@/lib/settings/merge";
import {
  isBrandColor,
  isSupportedLocale,
  isSupportedTimeZone,
  isWebsite,
  MAX_VALIDITY_DAYS,
  MIN_VALIDITY_DAYS,
  type SettingsLayer,
} from "@/lib/settings/schema";
import { validateQuoteNumberPattern } from "@/lib/quote-number";
import type { BrandingKind } from "@/lib/settings/types";

// Env-only configuration. Runtime code should use services/settings.ts
// getSettings(), which layers the Settings page (DB) on top of this.

export type AppConfig = {
  /** APP_NAME (installed-app name override), "" when unset */
  appName: string;
  company: {
    name: string;
    isDefault: boolean;
    nameLocal: string;
    address: string;
    vatNumber: string;
    email: string;
    phone: string;
    website: string;
  };
  payment: {
    bankName: string;
    bankCode: string;
    accountName: string;
    accountNumber: string;
  } | null;
  mail: {
    enabled: boolean;
    /** Cleaned Resend key — never expose to the client. */
    apiKey: string;
    senderName: string;
    senderEmail: string;
    ccEmails: string[];
    replyTo: string;
  };
  money: {
    currency: string;
    currencyLocale: string;
    defaultTaxRate: number;
  };
  quote: {
    numberPattern: string;
    validityDays: number;
    defaultNotes: string;
    defaultTerms: string;
  };
  appearance: { brandColor: string };
  region: { timezone: string };
  features: {
    twVatLookup: boolean;
  };
};

export type PublicAppConfig = {
  companyName: string;
  companyNameLocal: string;
  currency: string;
  currencyLocale: string;
  defaultTaxRate: number;
  twVatLookup: boolean;
};

export type QuoteBranding = {
  company: AppConfig["company"];
  logoDataUri: string;
  stampDataUri: string | null;
  payment: AppConfig["payment"];
  money: AppConfig["money"];
};

type Env = Record<string, string | undefined>;

// docker `--env-file` keeps values literally, including surrounding quotes,
// unlike dotenv / Next dev. Strip one layer of matching quotes so a quoted
// .env (COMPANY_NAME="Acme") behaves the same whichever loads it.
function clean(raw: string | undefined): string {
  if (raw === undefined) return "";
  const v = raw.trim();
  if (
    v.length >= 2 &&
    ((v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'")))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

// Env files cannot hold real line breaks; let multi-line texts use "\n".
function cleanMultiline(raw: string | undefined): string {
  return clean(raw).replace(/\\n/g, "\n");
}

function parseTaxRate(raw: string | undefined): number | undefined {
  const s = clean(raw);
  if (s === "") return undefined;
  const value = Number(s);
  if (Number.isNaN(value) || value < 0 || value > 100) return undefined;
  return value;
}

function parseValidityDays(raw: string | undefined): number | undefined {
  const s = clean(raw);
  if (!/^\d+$/.test(s)) return undefined;
  const days = Number(s);
  return days >= MIN_VALIDITY_DAYS && days <= MAX_VALIDITY_DAYS ? days : undefined;
}

function parseBrandColor(raw: string | undefined): string | undefined {
  const s = clean(raw);
  const color = s.startsWith("#") ? s : `#${s}`;
  return isBrandColor(color) ? color.toUpperCase() : undefined;
}

function parseTimeZone(...candidates: (string | undefined)[]): string | undefined {
  for (const raw of candidates) {
    const zone = clean(raw);
    if (zone && isSupportedTimeZone(zone)) return zone;
  }
  return undefined;
}

// Only "1" / "true" have ever enabled a flag; keep it that way so existing
// .env files ("yes", "on", …) do not silently switch features on.
function parseBoolean(raw: string | undefined): boolean | undefined {
  const s = clean(raw).toLowerCase();
  if (s === "") return undefined;
  return s === "1" || s === "true";
}

/** Drops unset (undefined / "" / []) fields so the layer only holds what env sets. */
function compact<T extends Record<string, unknown>>(fields: T): Partial<T> | undefined {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    (out as Record<string, unknown>)[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** The env-var layer of the settings (only variables that are set and valid). */
export function getEnvSettings(env: Env = process.env): EnvSettings {
  const currency = clean(env.CURRENCY).toUpperCase();
  const currencyLocale = clean(env.CURRENCY_LOCALE);
  const pattern = clean(env.QUOTE_NUMBER_PATTERN);

  const layer: SettingsLayer = {
    company: compact({
      name: clean(env.COMPANY_NAME),
      nameLocal: clean(env.COMPANY_NAME_LOCAL),
      address: clean(env.COMPANY_ADDRESS),
      vatNumber: clean(env.COMPANY_VAT_NUMBER),
      email: clean(env.COMPANY_EMAIL),
      phone: clean(env.COMPANY_PHONE),
      website: isWebsite(clean(env.COMPANY_WEBSITE)) ? clean(env.COMPANY_WEBSITE) : undefined,
    }),
    payment: compact({
      bankName: clean(env.BANK_NAME),
      bankCode: clean(env.BANK_CODE),
      accountName: clean(env.BANK_ACCOUNT_NAME),
      accountNumber: clean(env.BANK_ACCOUNT_NUMBER),
    }),
    quote: compact({
      numberPattern: pattern && validateQuoteNumberPattern(pattern).ok ? pattern : undefined,
      validityDays: parseValidityDays(env.QUOTE_VALIDITY_DAYS),
      defaultTaxRate: parseTaxRate(env.DEFAULT_TAX_RATE),
      defaultNotes: cleanMultiline(env.DEFAULT_NOTES),
      defaultTerms: cleanMultiline(env.DEFAULT_TERMS),
    }),
    money: compact({
      // Kept lenient (any 3 letters) like before: Intl formats unknown codes.
      currency: /^[A-Z]{3}$/.test(currency) ? currency : undefined,
      currencyLocale: isSupportedLocale(currencyLocale) ? currencyLocale : undefined,
    }),
    appearance: compact({ brandColor: parseBrandColor(env.BRAND_COLOR) }),
    region: compact({ timezone: parseTimeZone(env.APP_TIMEZONE, env.TZ) }),
    mail: compact({
      senderName: clean(env.MAIL_SENDER_NAME),
      senderEmail: clean(env.MAIL_SENDER_EMAIL),
      ccEmails: clean(env.MAIL_CC_EMAILS)
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
      replyTo: clean(env.MAIL_REPLY_TO),
    }),
    features: compact({ twVatLookup: parseBoolean(env.TW_VAT_LOOKUP) }),
  };

  return {
    layer,
    apiKey: clean(env.RESEND_API_KEY),
    authEnabled: authEnabled(env),
  };
}

/** APP_NAME, "" when unset. */
export function getAppNameOverride(env: Env = process.env): string {
  return clean(env.APP_NAME);
}

export function getAppConfig(env: Env = process.env): AppConfig {
  const s = mergeSettings(SETTINGS_DEFAULTS, getEnvSettings(env), {});
  return {
    appName: getAppNameOverride(env),
    company: {
      name: s.company.name,
      isDefault: s.company.isDefault,
      nameLocal: s.company.nameLocal,
      address: s.company.address,
      vatNumber: s.company.vatNumber,
      email: s.company.email,
      phone: s.company.phone,
      website: s.company.website,
    },
    payment: s.payment,
    mail: {
      enabled: s.mail.enabled,
      apiKey: s.mail.apiKey,
      senderName: s.mail.senderName,
      senderEmail: s.mail.senderEmail,
      ccEmails: s.mail.ccEmails,
      replyTo: s.mail.replyTo,
    },
    money: {
      currency: s.money.currency,
      currencyLocale: s.money.currencyLocale,
      defaultTaxRate: s.quote.defaultTaxRate,
    },
    quote: {
      numberPattern: s.quote.numberPattern,
      validityDays: s.quote.validityDays,
      defaultNotes: s.quote.defaultNotes,
      defaultTerms: s.quote.defaultTerms,
    },
    appearance: s.appearance,
    region: s.region,
    features: s.features,
  };
}

export function toPublicConfig(config: AppConfig): PublicAppConfig {
  return {
    companyName: config.company.name,
    companyNameLocal: config.company.nameLocal,
    currency: config.money.currency,
    currencyLocale: config.money.currencyLocale,
    defaultTaxRate: config.money.defaultTaxRate,
    twVatLookup: config.features.twVatLookup,
  };
}

/** On-disk branding files in fallback order (branding/ is the legacy mount). */
export function brandingCandidates(kind: BrandingKind, baseDir: string = process.cwd()): string[] {
  const user = (file: string) => path.join(baseDir, "branding", file);
  const fallback = (file: string) =>
    path.join(baseDir, "branding-defaults", file);
  switch (kind) {
    case "logo":
      return [user("logo.png"), fallback("logo.png")];
    case "stamp":
      return [user("stamp.png")];
    case "icon":
      return [user("icon.png"), user("logo.png"), fallback("logo.png")];
  }
}

export function getBrandingFile(
  kind: BrandingKind,
  baseDir: string = process.cwd()
): Buffer | null {
  for (const candidate of brandingCandidates(kind, baseDir)) {
    try {
      return fs.readFileSync(candidate);
    } catch {
      // try next candidate
    }
  }
  return null;
}

export function getBrandingDataUri(
  kind: BrandingKind,
  baseDir: string = process.cwd()
): string | null {
  const file = getBrandingFile(kind, baseDir);
  if (!file) return null;
  return `data:image/png;base64,${file.toString("base64")}`;
}

/** Env/disk-only branding; prefer services/settings getDocumentBranding("pdf"). */
export function getQuoteBranding(): QuoteBranding {
  const config = getAppConfig();
  return {
    company: config.company,
    // logo 永遠有值:branding-defaults/logo.png 是 committed 檔案
    logoDataUri: getBrandingDataUri("logo") ?? "",
    stampDataUri: getBrandingDataUri("stamp"),
    payment: config.payment,
    money: config.money,
  };
}
