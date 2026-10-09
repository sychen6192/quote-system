// Validation for the Settings page (spec §6). Pure and client-safe: the form
// (zodResolver), saveSettings and the DB/env readers all use these schemas.
// Every message is a KEY of the "Validation" i18n namespace.
import { z } from "zod";
import { validateQuoteNumberPattern } from "@/lib/quote-number";
import type { BrandingKind } from "./types";

export const SETTINGS_SECTIONS = [
  "company",
  "payment",
  "quote",
  "money",
  "appearance",
  "region",
  "mail",
  "features",
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const BRANDING_KINDS = ["logo", "stamp", "icon"] as const satisfies readonly BrandingKind[];

export const MAX_TEXT_LENGTH = 500;
export const MAX_LONG_TEXT_LENGTH = 5000;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_CC_EMAILS = 5;
export const MIN_VALIDITY_DAYS = 1;
export const MAX_VALIDITY_DAYS = 365;
export const BRAND_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function isSettingsSection(value: unknown): value is SettingsSection {
  return typeof value === "string" && (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

export function isBrandingKind(value: unknown): value is BrandingKind {
  return typeof value === "string" && (BRANDING_KINDS as readonly string[]).includes(value);
}

const EMAIL = z.email();
export function isEmail(value: string): boolean {
  return EMAIL.safeParse(value).success;
}

export function isBrandColor(value: string): boolean {
  return BRAND_COLOR_RE.test(value);
}

/** ISO 4217 code that this runtime's Intl can format. */
export function isSupportedCurrency(code: string): boolean {
  if (!/^[A-Z]{3}$/.test(code)) return false;
  try {
    // Intl.NumberFormat accepts any well-formed code ("ABC"), so prefer the list.
    if (typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("currency").includes(code);
    }
    new Intl.NumberFormat("en", { style: "currency", currency: code });
    return true;
  } catch {
    return false;
  }
}

export function isSupportedLocale(tag: string): boolean {
  if (!tag) return false;
  try {
    return Intl.NumberFormat.supportedLocalesOf(tag).length > 0;
  } catch {
    return false;
  }
}

// IANA names only: newer runtimes also accept offsets like "+08:00", which
// Postgres would read as POSIX (inverted sign) if a zone ever reached SQL.
const IANA_ZONE_RE = /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/;

export function isSupportedTimeZone(zone: string): boolean {
  if (!IANA_ZONE_RE.test(zone)) return false;
  if (
    typeof Intl.supportedValuesOf === "function" &&
    Intl.supportedValuesOf("timeZone").includes(zone)
  ) {
    return true;
  }
  // The list omits aliases such as "UTC" or "Asia/Calcutta".
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function hasAtMostDecimals(value: number, decimals: number): boolean {
  const scaled = value * 10 ** decimals;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

// Control characters: Postgres jsonb rejects \u0000 (the save would fail
// with a generic error) and the rest only garble PDFs and emails.
const SINGLE_LINE_FORBIDDEN_RE = /[\u0000-\u001f\u007f]/;
const MULTI_LINE_FORBIDDEN_RE = /[\u0000-\u0008\u000b-\u001f\u007f]/;

const singleLine = (max = MAX_TEXT_LENGTH) =>
  z
    .string({ error: "invalidText" })
    .trim()
    .max(max, "tooLong")
    .refine((v) => !SINGLE_LINE_FORBIDDEN_RE.test(v), { error: "invalidText" });

const multiLine = (max = MAX_TEXT_LENGTH) =>
  z
    .string({ error: "invalidText" })
    .transform((v) => v.replace(/\r\n?/g, "\n").trim())
    .pipe(
      z
        .string()
        .max(max, "tooLong")
        .refine((v) => !MULTI_LINE_FORBIDDEN_RE.test(v), { error: "invalidText" })
    );

const requiredLine = (max = MAX_TEXT_LENGTH) =>
  singleLine(max).refine((v) => v !== "", { error: "required" });

const optionalEmail = () =>
  z
    .string({ error: "invalidEmail" })
    .trim()
    .max(MAX_EMAIL_LENGTH, "tooLong")
    .refine((v) => v === "" || isEmail(v), { error: "invalidEmail" });

// Forms send numbers (valueAsNumber) or strings from text inputs.
const numeric = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? Number(v.trim()) : v),
    schema
  );

// Host name (IDN allowed) with an optional http(s) scheme: rejects
// "javascript:…" and the like, since the value may end up in an href.
const WEBSITE_RE =
  /^(https?:\/\/)?([\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+\p{L}{2,}(:\d{1,5})?([/?#]\S*)?$/iu;

export function isWebsite(value: string): boolean {
  return value.length <= 200 && WEBSITE_RE.test(value);
}

const website = () =>
  singleLine(200).refine((v) => v === "" || isWebsite(v), { error: "invalidUrl" });

const ccEmails = () =>
  z
    .union(
      [
        z.array(z.string({ error: "invalidEmail" })),
        // Also accept "a@x.test, b@y.test" from a single text input.
        z.string({ error: "invalidEmail" }).transform((v) => v.split(/[,;\s]+/)),
      ],
      { error: "invalidEmail" }
    )
    .transform((list) => list.map((e) => e.trim()).filter(Boolean))
    .pipe(
      z
        .array(
          z
            .string()
            .max(MAX_EMAIL_LENGTH, "tooLong")
            .refine(isEmail, { error: "invalidEmail" })
        )
        .max(MAX_CC_EMAILS, "tooManyRecipients")
    );

export const settingsSectionSchemas = {
  company: z.object({
    name: singleLine(),
    nameLocal: singleLine(),
    address: multiLine(),
    vatNumber: singleLine(50),
    email: optionalEmail(),
    phone: singleLine(50),
    website: website(),
  }),
  payment: z.object({
    bankName: singleLine(),
    bankCode: singleLine(20),
    accountName: singleLine(),
    accountNumber: singleLine(50),
  }),
  quote: z.object({
    numberPattern: requiredLine(64).superRefine((v, ctx) => {
      const result = validateQuoteNumberPattern(v);
      // EMPTY and TOO_LONG are already reported as required / tooLong.
      if (!result.ok && result.error !== "EMPTY" && result.error !== "TOO_LONG") {
        ctx.addIssue({ code: "custom", message: "invalidNumberPattern" });
      }
    }),
    validityDays: numeric(
      z
        .number({ error: "invalidNumber" })
        .int("invalidNumber")
        .min(MIN_VALIDITY_DAYS, "validityDaysRange")
        .max(MAX_VALIDITY_DAYS, "validityDaysRange")
    ),
    defaultTaxRate: numeric(
      z
        .number({ error: "invalidNumber" })
        .min(0, "taxRateRange")
        .max(100, "taxRateRange")
        .refine((v) => hasAtMostDecimals(v, 2), { error: "tooManyDecimals" })
    ),
    defaultNotes: multiLine(MAX_LONG_TEXT_LENGTH),
    defaultTerms: multiLine(MAX_LONG_TEXT_LENGTH),
    defaultSalesperson: singleLine(100),
    showAmountInWords: z.boolean({ error: "invalidValue" }),
    footerText: multiLine(),
  }),
  money: z.object({
    currency: z
      .string({ error: "invalidCurrency" })
      .trim()
      .toUpperCase()
      .refine(isSupportedCurrency, { error: "invalidCurrency" }),
    currencyLocale: z
      .string({ error: "invalidLocale" })
      .trim()
      .refine(isSupportedLocale, { error: "invalidLocale" }),
  }),
  appearance: z.object({
    brandColor: z
      .string({ error: "invalidColor" })
      .trim()
      .refine(isBrandColor, { error: "invalidColor" })
      .transform((v) => v.toUpperCase()),
  }),
  region: z.object({
    timezone: z
      .string({ error: "invalidTimezone" })
      .trim()
      .refine(isSupportedTimeZone, { error: "invalidTimezone" }),
  }),
  mail: z.object({
    senderName: singleLine(100),
    senderEmail: optionalEmail(),
    ccEmails: ccEmails(),
    replyTo: optionalEmail(),
  }),
  features: z.object({
    twVatLookup: z.boolean({ error: "invalidValue" }),
  }),
};

type SectionSchemas = typeof settingsSectionSchemas;

/** Validated values of one section (what a complete save produces). */
export type SettingsValues = {
  [S in SettingsSection]: z.output<SectionSchemas[S]>;
};

/** Form input of one section. */
export type SettingsInput<S extends SettingsSection> = z.input<SectionSchemas[S]>;

/**
 * A partial set of settings, as stored in app_settings.data or read from env.
 * A field is "set" iff its key is present (an empty string is a value).
 */
export type SettingsLayer = {
  [S in SettingsSection]?: Partial<SettingsValues[S]>;
};

export type SettingsPatchResult =
  | {
      success: true;
      /** validated fields to store */
      set: Record<string, unknown>;
      /** fields sent as null: removed from the DB so env/defaults apply again */
      reset: string[];
    }
  | { success: false; fieldErrors: Record<string, string[]> };

/**
 * Validates a (partial) section save. Unknown keys are ignored; `null`
 * means "reset this field to the env/default value".
 */
export function parseSettingsPatch(section: SettingsSection, data: unknown): SettingsPatchResult {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { success: false, fieldErrors: { _form: ["invalidValue"] } };
  }
  const schema = settingsSectionSchemas[section];
  const known = Object.keys(schema.shape);
  const values: Record<string, unknown> = {};
  const reset: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (!known.includes(key) || value === undefined) continue;
    if (value === null) reset.push(key);
    else values[key] = value;
  }
  const parsed = schema.partial().safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.map(String).join(".") || "_form";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { success: false, fieldErrors };
  }
  return { success: true, set: parsed.data, reset };
}

/**
 * Reads untrusted stored data (app_settings.data) field by field: anything
 * that no longer validates (older schema, manual edits) is ignored, so it
 * falls back to env/defaults instead of breaking every page.
 */
export function parseSettingsLayer(data: unknown): SettingsLayer {
  const layer: Record<string, Record<string, unknown>> = {};
  if (data === null || typeof data !== "object" || Array.isArray(data)) return layer;
  for (const section of SETTINGS_SECTIONS) {
    const stored = (data as Record<string, unknown>)[section];
    if (stored === null || typeof stored !== "object" || Array.isArray(stored)) continue;
    const shape = settingsSectionSchemas[section].shape as Record<string, z.ZodType>;
    const out: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(shape)) {
      if (!Object.prototype.hasOwnProperty.call(stored, key)) continue;
      const value = (stored as Record<string, unknown>)[key];
      if (value === null || value === undefined) continue;
      const parsed = field.safeParse(value);
      if (parsed.success) out[key] = parsed.data;
    }
    if (Object.keys(out).length > 0) layer[section] = out;
  }
  return layer as SettingsLayer;
}
