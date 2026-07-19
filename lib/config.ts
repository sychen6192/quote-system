import * as fs from "node:fs";
import * as path from "node:path";

export type AppConfig = {
  company: {
    name: string;
    isDefault: boolean;
    nameLocal: string;
    address: string;
    vatNumber: string;
    email: string;
    phone: string;
  };
  payment: {
    bankName: string;
    accountName: string;
    accountNumber: string;
  } | null;
  mail: {
    enabled: boolean;
    senderName: string;
    senderEmail: string;
    ccEmails: string[];
  };
  money: {
    currency: string;
    currencyLocale: string;
    defaultTaxRate: number;
  };
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

const DEFAULT_COMPANY_NAME = "Your Company";
const DEFAULT_SENDER_EMAIL = "onboarding@resend.dev";
const DEFAULT_TAX_RATE = 5;

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

function parseTaxRate(raw: string | undefined): number {
  const s = clean(raw);
  if (s === "") return DEFAULT_TAX_RATE;
  const value = Number(s);
  if (Number.isNaN(value) || value < 0 || value > 100) return DEFAULT_TAX_RATE;
  return value;
}

export function getAppConfig(
  env: Record<string, string | undefined> = process.env
): AppConfig {
  const name = clean(env.COMPANY_NAME) || DEFAULT_COMPANY_NAME;
  const isDefault = clean(env.COMPANY_NAME) === "";

  const bankName = clean(env.BANK_NAME);
  const accountName = clean(env.BANK_ACCOUNT_NAME);
  const accountNumber = clean(env.BANK_ACCOUNT_NUMBER);
  const payment =
    bankName || accountName || accountNumber
      ? { bankName, accountName, accountNumber }
      : null;

  const ccEmails = clean(env.MAIL_CC_EMAILS)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const twVat = clean(env.TW_VAT_LOOKUP).toLowerCase();

  return {
    company: {
      name,
      isDefault,
      nameLocal: clean(env.COMPANY_NAME_LOCAL),
      address: clean(env.COMPANY_ADDRESS),
      vatNumber: clean(env.COMPANY_VAT_NUMBER),
      email: clean(env.COMPANY_EMAIL),
      phone: clean(env.COMPANY_PHONE),
    },
    payment,
    mail: {
      enabled: clean(env.RESEND_API_KEY) !== "",
      senderName: clean(env.MAIL_SENDER_NAME) || name,
      senderEmail: clean(env.MAIL_SENDER_EMAIL) || DEFAULT_SENDER_EMAIL,
      ccEmails,
    },
    money: {
      currency: clean(env.CURRENCY) || "TWD",
      currencyLocale: clean(env.CURRENCY_LOCALE) || "zh-TW",
      defaultTaxRate: parseTaxRate(env.DEFAULT_TAX_RATE),
    },
    features: {
      twVatLookup: twVat === "1" || twVat === "true",
    },
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

type BrandingKind = "logo" | "stamp" | "icon";

function brandingCandidates(kind: BrandingKind, baseDir: string): string[] {
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
