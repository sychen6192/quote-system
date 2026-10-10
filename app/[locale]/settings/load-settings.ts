import "server-only";
import { assertAuthenticated } from "@/lib/auth/guard";
import { todayInTimeZone } from "@/lib/dates";
import { SETTINGS_DEFAULTS } from "@/lib/settings/merge";
import { SETTINGS_SECTIONS, type SettingsSection } from "@/lib/settings/schema";
import { getBrandingStatus, getSettings, getSettingsProvenance } from "@/services/settings";
import { resolveSettingsFields, type SettingsPageData } from "@/components/settings/model";
import pkg from "@/package.json";

// npm sets npm_package_version for `npm start`; the standalone server
// (`node server.js`) does not, so the bundled package.json comes first.
function appVersion(): string {
  return pkg.version || process.env.npm_package_version || "";
}

/**
 * Values and provenance (Settings page / .env / default) of every field,
 * with the same precedence as getSettings(): the env and stored layers come
 * from getSettingsProvenance(), which reads the database uncached, so the
 * page shows a save immediately. Fails closed for a signed-out request.
 */
export async function loadSettingsPageData(): Promise<SettingsPageData> {
  await assertAuthenticated();
  const [settings, branding, provenance] = await Promise.all([
    getSettings(),
    getBrandingStatus(),
    getSettingsProvenance(),
  ]);

  const defaults = {} as Record<SettingsSection, Record<string, unknown>>;
  for (const section of SETTINGS_SECTIONS) {
    defaults[section] = { ...(SETTINGS_DEFAULTS[section] as Record<string, unknown>) };
  }
  // Not in SETTINGS_DEFAULTS: on by default for TWD (mergeSettings).
  defaults.quote.showAmountInWords = settings.money.currency === "TWD";

  const { values, meta } = resolveSettingsFields(defaults, provenance.env, provenance.stored);

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
    storeUnavailable: provenance.storeUnavailable,
  };
}
