// Effective settings = built-in defaults ← env vars ← DB (Settings page),
// per field (spec §6). Pure: services/settings.ts does the I/O.
import { currencyFractionDigits } from "@/lib/money";
import { DEFAULT_QUOTE_NUMBER_PATTERN } from "@/lib/quote-number";
import {
  parseSettingsLayer,
  type SettingsLayer,
  type SettingsSection,
  type SettingsValues,
} from "./schema";
import type { EffectiveSettings } from "./types";

export type SettingsDefaults = {
  [S in SettingsSection]: S extends "quote"
    ? Omit<SettingsValues["quote"], "showAmountInWords">
    : SettingsValues[S];
};

export const DEFAULT_COMPANY_NAME = "Your Company";
export const DEFAULT_SENDER_EMAIL = "onboarding@resend.dev";
export const DEFAULT_BRAND_COLOR = "#1D4ED8";
export const DEFAULT_TIMEZONE = "Asia/Taipei";

export const SETTINGS_DEFAULTS: SettingsDefaults = {
  company: {
    name: DEFAULT_COMPANY_NAME,
    nameLocal: "",
    address: "",
    vatNumber: "",
    email: "",
    phone: "",
    website: "",
  },
  payment: { bankName: "", bankCode: "", accountName: "", accountNumber: "" },
  quote: {
    numberPattern: DEFAULT_QUOTE_NUMBER_PATTERN,
    validityDays: 30,
    defaultTaxRate: 5,
    defaultNotes: "",
    defaultTerms: "",
    defaultSalesperson: "",
    footerText: "",
  },
  money: { currency: "TWD", currencyLocale: "zh-TW" },
  appearance: { brandColor: DEFAULT_BRAND_COLOR },
  region: { timezone: DEFAULT_TIMEZONE },
  mail: {
    senderName: "",
    senderEmail: DEFAULT_SENDER_EMAIL,
    ccEmails: [],
    replyTo: "",
  },
  features: { twVatLookup: false },
};

/** What env vars contribute (lib/config.ts getEnvSettings). */
export type EnvSettings = {
  /** only the fields whose env var is set (non-empty) and valid */
  layer: SettingsLayer;
  /** RESEND_API_KEY — env only, never stored or sent to the client */
  apiKey: string;
  /** APP_PASSWORD is set */
  authEnabled: boolean;
};

export type SettingsMeta = {
  /** app_settings.updated_at */
  updatedAt?: Date | string | null;
  /**
   * Anything whose change must bust caches of branding images and PDFs,
   * e.g. { "db:logo": updatedAt, "file:branding/logo.png": mtime }.
   */
  brandingStamps?: Record<string, string>;
};

// Text fields where a saved "" means "hide it" rather than "not set".
// The others (name, pattern, currency, …) fall back when blank.
const BLANK_IS_A_VALUE: { [S in SettingsSection]?: readonly string[] } = {
  company: ["nameLocal", "address", "vatNumber", "email", "phone", "website"],
  payment: ["bankName", "bankCode", "accountName", "accountNumber"],
  quote: ["defaultNotes", "defaultTerms", "defaultSalesperson", "footerText"],
  mail: ["ccEmails", "replyTo"],
};

const isBlank = (value: unknown) =>
  value === "" || (Array.isArray(value) && value.length === 0);

type Source = "db" | "env" | "default";

function resolver(defaults: SettingsDefaults, env: SettingsLayer, db: SettingsLayer) {
  function source<S extends SettingsSection>(section: S, key: string): Source {
    const blankOk = BLANK_IS_A_VALUE[section]?.includes(key) ?? false;
    const dbValue = (db[section] as Record<string, unknown> | undefined)?.[key];
    if (dbValue !== undefined && (blankOk || !isBlank(dbValue))) return "db";
    const envValue = (env[section] as Record<string, unknown> | undefined)?.[key];
    if (envValue !== undefined && !isBlank(envValue)) return "env";
    return "default";
  }

  function pick<S extends SettingsSection, K extends keyof SettingsValues[S] & string>(
    section: S,
    key: K
  ): SettingsValues[S][K] {
    const from = source(section, key);
    const layer = from === "db" ? db : from === "env" ? env : null;
    const value = layer
      ? (layer[section] as Record<string, unknown>)[key]
      : (defaults[section] as Record<string, unknown>)[key];
    return value as SettingsValues[S][K];
  }

  return { pick, source };
}

/**
 * Small, fast, non-cryptographic string hash (cyrb53) → base36. Only used for
 * cache-busting versions, so it must be stable, not secret.
 */
export function hashString(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function isoOf(value: Date | string | null | undefined): string {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  return value ?? "";
}

/**
 * @param stored raw app_settings.data (validated field by field here)
 */
export function mergeSettings(
  defaults: SettingsDefaults,
  env: EnvSettings,
  stored: unknown,
  meta: SettingsMeta = {}
): EffectiveSettings {
  const db = parseSettingsLayer(stored);
  const { pick, source } = resolver(defaults, env.layer, db);

  const companyName = pick("company", "name");
  const company: EffectiveSettings["company"] = {
    name: companyName,
    nameLocal: pick("company", "nameLocal"),
    address: pick("company", "address"),
    vatNumber: pick("company", "vatNumber"),
    email: pick("company", "email"),
    phone: pick("company", "phone"),
    website: pick("company", "website"),
    isDefault: source("company", "name") === "default",
  };

  const paymentFields = {
    bankName: pick("payment", "bankName"),
    bankCode: pick("payment", "bankCode"),
    accountName: pick("payment", "accountName"),
    accountNumber: pick("payment", "accountNumber"),
  };
  const payment = Object.values(paymentFields).some((v) => v !== "") ? paymentFields : null;

  const currency = pick("money", "currency");
  const storedWords = db.quote?.showAmountInWords ?? env.layer.quote?.showAmountInWords;

  const settings: EffectiveSettings = {
    company,
    payment,
    quote: {
      numberPattern: pick("quote", "numberPattern"),
      validityDays: pick("quote", "validityDays"),
      defaultTaxRate: pick("quote", "defaultTaxRate"),
      defaultNotes: pick("quote", "defaultNotes"),
      defaultTerms: pick("quote", "defaultTerms"),
      defaultSalesperson: pick("quote", "defaultSalesperson"),
      showAmountInWords: storedWords ?? currency === "TWD",
      footerText: pick("quote", "footerText"),
    },
    money: {
      currency,
      currencyLocale: pick("money", "currencyLocale"),
      fractionDigits: currencyFractionDigits(currency),
    },
    appearance: { brandColor: pick("appearance", "brandColor") },
    region: { timezone: pick("region", "timezone") },
    mail: {
      enabled: env.apiKey !== "",
      apiKey: env.apiKey,
      senderName: pick("mail", "senderName") || companyName,
      senderEmail: pick("mail", "senderEmail"),
      ccEmails: [...pick("mail", "ccEmails")],
      replyTo: pick("mail", "replyTo"),
    },
    features: { twVatLookup: pick("features", "twVatLookup") },
    auth: { enabled: env.authEnabled },
    version: "",
  };

  settings.version = settingsVersion(settings, meta);
  return settings;
}

/**
 * Changes whenever the stored settings, a branding asset or the effective
 * values (e.g. an env var after a restart) change.
 */
export function settingsVersion(settings: EffectiveSettings, meta: SettingsMeta = {}): string {
  const stamps = Object.entries(meta.brandingStamps ?? {}).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  );
  const content = {
    ...settings,
    mail: { ...settings.mail, apiKey: settings.mail.apiKey ? "set" : "" },
    version: undefined,
  };
  return hashString(JSON.stringify([isoOf(meta.updatedAt), stamps, content]));
}
