import { pickCompanyName } from "@/lib/company-name";
import type { PublicAppConfig } from "@/lib/settings/types";

// services/settings.ts falls back to this English name when neither APP_NAME
// nor a company name is configured; the UI shows its translation instead.
const BUILT_IN_APP_NAME = "Quote System";

type BrandConfig = Pick<
  PublicAppConfig,
  "appName" | "companyName" | "companyNameLocal" | "isDefaultCompany"
>;

/** The installed-app name, translated when it is the built-in default. */
export function appDisplayName(config: BrandConfig, translatedDefault: string): string {
  const name = config.appName.trim();
  return !name || name === BUILT_IN_APP_NAME ? translatedDefault : name;
}

/** What the shell shows as the brand: the company in the UI language, else the app name. */
export function brandDisplayName(
  config: BrandConfig,
  locale: string,
  translatedDefault: string
): string {
  if (config.isDefaultCompany) return appDisplayName(config, translatedDefault);
  return pickCompanyName(config.companyName, config.companyNameLocal, locale);
}

const CJK_SUFFIX = /(股份有限公司|有限公司|工作室|公司)$/;
const LATIN_SUFFIX = /[,\s]+(inc\.?|ltd\.?|llc|co\.?,?\s*ltd\.?|corp\.?|corporation|limited|gmbh)$/i;

/**
 * A home-screen label: the name without its legal suffix ("艾克米科技股份有限公司"
 * → "艾克米科技", "Acme Inc." → "Acme"), since iOS truncates long titles.
 */
export function shortAppName(name: string): string {
  const full = name.trim();
  const short = full.replace(CJK_SUFFIX, "").replace(LATIN_SUFFIX, "").trim();
  return short || full;
}
