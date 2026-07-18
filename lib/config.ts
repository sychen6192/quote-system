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
};

export type PublicAppConfig = {
  companyName: string;
  currency: string;
  currencyLocale: string;
  defaultTaxRate: number;
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

function parseTaxRate(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_TAX_RATE;
  const value = Number(raw);
  if (Number.isNaN(value) || value < 0 || value > 100) return DEFAULT_TAX_RATE;
  return value;
}

export function getAppConfig(
  env: Record<string, string | undefined> = process.env
): AppConfig {
  const name = env.COMPANY_NAME?.trim() || DEFAULT_COMPANY_NAME;
  const isDefault = !env.COMPANY_NAME?.trim();

  const bankName = env.BANK_NAME?.trim() ?? "";
  const accountName = env.BANK_ACCOUNT_NAME?.trim() ?? "";
  const accountNumber = env.BANK_ACCOUNT_NUMBER?.trim() ?? "";
  const payment =
    bankName || accountName || accountNumber
      ? { bankName, accountName, accountNumber }
      : null;

  const ccEmails = (env.MAIL_CC_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return {
    company: {
      name,
      isDefault,
      nameLocal: env.COMPANY_NAME_LOCAL?.trim() ?? "",
      address: env.COMPANY_ADDRESS?.trim() ?? "",
      vatNumber: env.COMPANY_VAT_NUMBER?.trim() ?? "",
      email: env.COMPANY_EMAIL?.trim() ?? "",
      phone: env.COMPANY_PHONE?.trim() ?? "",
    },
    payment,
    mail: {
      enabled: Boolean(env.RESEND_API_KEY),
      senderName: env.MAIL_SENDER_NAME?.trim() || name,
      senderEmail: env.MAIL_SENDER_EMAIL?.trim() || DEFAULT_SENDER_EMAIL,
      ccEmails,
    },
    money: {
      currency: env.CURRENCY?.trim() || "TWD",
      currencyLocale: env.CURRENCY_LOCALE?.trim() || "zh-TW",
      defaultTaxRate: parseTaxRate(env.DEFAULT_TAX_RATE),
    },
  };
}

export function toPublicConfig(config: AppConfig): PublicAppConfig {
  return {
    companyName: config.company.name,
    currency: config.money.currency,
    currencyLocale: config.money.currencyLocale,
    defaultTaxRate: config.money.defaultTaxRate,
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
