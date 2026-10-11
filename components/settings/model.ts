// Pure, client-safe model of the Settings page: tabs ↔ URL hash, where each
// field's value comes from (Settings page / .env / built-in default) and the
// patch a section save sends. Sources come from lib/settings/merge.ts, the
// rules getSettings() itself follows (tests/unit/settings-ui checks the
// values agree too).
import { blankIsAValue, isBlankSetting, settingSource } from "@/lib/settings/merge";
import type {
  SettingsLayer,
  SettingsSection,
} from "@/lib/settings/schema";
import type { BrandingKind } from "@/lib/settings/types";

export const SETTINGS_TABS = [
  "company",
  "branding",
  "quotes",
  "payment",
  "email",
  "regional",
  "about",
] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];
export const DEFAULT_TAB: SettingsTab = "company";

/** Set on <html> by the page's inline script on a hard load with a #hash. */
export const HASH_TAB_ATTRIBUTE = "data-settings-tab";

export function isSettingsTab(value: unknown): value is SettingsTab {
  return typeof value === "string" && (SETTINGS_TABS as readonly string[]).includes(value);
}

/** "#branding" → "branding"; anything else → null. */
export function tabFromHash(hash: string | null | undefined): SettingsTab | null {
  const key = decodeURIComponent((hash ?? "").replace(/^#/, "")).trim().toLowerCase();
  return isSettingsTab(key) ? key : null;
}

export type FieldSource = "db" | "env" | "default";
export type FieldValue = string | number | boolean | string[];

export type FieldMeta = {
  source: FieldSource;
  /** What applies once the saved value is removed: the .env value, else the default. */
  fallback: FieldValue;
};

export type SectionValues = Record<string, FieldValue>;
export type SettingsSnapshot = Record<SettingsSection, SectionValues>;
export type SettingsFieldMeta = Record<SettingsSection, Record<string, FieldMeta>>;

function layerValue(layer: SettingsLayer, section: SettingsSection, key: string): unknown {
  return (layer[section] as Record<string, unknown> | undefined)?.[key];
}

function asFieldValue(value: unknown): FieldValue {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return "";
}

/**
 * Each field's value and provenance, with the precedence of mergeSettings:
 * a saved value wins unless it is blank where blank means "unset"; then a
 * non-blank env value; then the default.
 *
 * @param defaults every field of every section (including
 *   quote.showAmountInWords, whose default depends on the currency)
 */
export function resolveSettingsFields(
  defaults: Record<SettingsSection, Record<string, unknown>>,
  env: SettingsLayer,
  db: SettingsLayer
): { values: SettingsSnapshot; meta: SettingsFieldMeta } {
  const values = {} as SettingsSnapshot;
  const meta = {} as SettingsFieldMeta;
  for (const section of Object.keys(defaults) as SettingsSection[]) {
    values[section] = {};
    meta[section] = {};
    for (const [key, fallbackDefault] of Object.entries(defaults[section])) {
      const envValue = layerValue(env, section, key);
      const envSet = envValue !== undefined && !isBlankSetting(envValue);
      const fallback = envSet ? envValue : fallbackDefault;
      const source: FieldSource = settingSource(section, key, env, db);
      values[section][key] = asFieldValue(source === "db" ? layerValue(db, section, key) : fallback);
      meta[section][key] = { source, fallback: asFieldValue(fallback) };
    }
  }
  return { values, meta };
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, i) => sameValue(item, b[i]))
    );
  }
  return Object.is(a, b);
}

/** Keys whose current value differs from the initial one. */
export function changedKeys(
  initial: Record<string, unknown>,
  current: Record<string, unknown>,
  keys: readonly string[] = Object.keys(initial)
): string[] {
  return keys.filter((key) => !sameValue(initial[key], current[key]));
}

/**
 * What saveSettings(section, …) receives: only the changed fields (so values
 * still coming from .env are not frozen into the database), with a cleared
 * field sent as null — "use the fallback again" — where blank is not a value.
 */
export function buildSectionPatch(
  section: SettingsSection,
  keys: readonly string[],
  parsed: Record<string, unknown>
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const key of keys) {
    const value = parsed[key];
    if (value === undefined) continue;
    patch[key] = !blankIsAValue(section, key) && isBlankSetting(value) ? null : value;
  }
  return patch;
}

/** Server field-error paths ("ccEmails.1") → the form field they belong to. */
export function formFieldOfErrorPath(path: string, fields: readonly string[]): string | null {
  const head = path.split(".")[0];
  return fields.includes(head) ? head : null;
}

export type BrandingSource = "db" | "file" | "default" | "none";
export type BrandingStatus = Record<BrandingKind, BrandingSource>;

/** Everything the client Settings page needs (serialisable, no secrets). */
export type SettingsPageData = {
  values: SettingsSnapshot;
  meta: SettingsFieldMeta;
  branding: BrandingStatus;
  /** settings version, for cache-busted branding image URLs */
  version: string;
  /** effective company name (sender-name placeholder, previews) */
  companyName: string;
  mailEnabled: boolean;
  authEnabled: boolean;
  appVersion: string;
  /** YYYY-MM-DD in the business time zone */
  today: string;
  /** the Settings store could not be read: values shown are env/defaults */
  storeUnavailable: boolean;
};
