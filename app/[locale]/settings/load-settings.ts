import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { getEnvSettings } from "@/lib/config";
import { todayInTimeZone } from "@/lib/dates";
import { SETTINGS_DEFAULTS } from "@/lib/settings/merge";
import {
  parseSettingsLayer,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from "@/lib/settings/schema";
import { getBrandingStatus, getSettings } from "@/services/settings";
import { resolveSettingsFields, type SettingsPageData } from "@/components/settings/model";
import pkg from "@/package.json";

/** The raw app_settings.data, or null when the database cannot be read. */
async function readStoredData(): Promise<unknown | null> {
  try {
    const [row] = await db
      .select({ data: appSettings.data })
      .from(appSettings)
      .where(eq(appSettings.id, 1))
      .limit(1);
    return row?.data ?? {};
  } catch (error) {
    console.warn(
      "settings page: could not read app_settings, showing env/defaults",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

// npm sets npm_package_version for `npm start`; the standalone server
// (`node server.js`) does not, so the bundled package.json comes first.
function appVersion(): string {
  return pkg.version || process.env.npm_package_version || "";
}

/**
 * Values and provenance (Settings page / .env / default) of every field,
 * with the same precedence as getSettings(). services/settings.ts has no
 * provenance API, so the stored layer is read here directly.
 */
export async function loadSettingsPageData(): Promise<SettingsPageData> {
  const [settings, branding, stored] = await Promise.all([
    getSettings(),
    getBrandingStatus(),
    readStoredData(),
  ]);

  const defaults = {} as Record<SettingsSection, Record<string, unknown>>;
  for (const section of SETTINGS_SECTIONS) {
    defaults[section] = { ...(SETTINGS_DEFAULTS[section] as Record<string, unknown>) };
  }
  // Not in SETTINGS_DEFAULTS: on by default for TWD (mergeSettings).
  defaults.quote.showAmountInWords = settings.money.currency === "TWD";

  const { values, meta } = resolveSettingsFields(
    defaults,
    getEnvSettings().layer,
    parseSettingsLayer(stored ?? {})
  );

  return {
    values,
    meta,
    branding,
    version: settings.version,
    companyName: settings.company.name,
    mailEnabled: settings.mail.enabled,
    authEnabled: settings.auth.enabled,
    appVersion: appVersion(),
    today: todayInTimeZone(settings.region.timezone),
    storeUnavailable: stored === null,
  };
}
