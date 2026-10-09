// "Env only" deployments must behave exactly as before the Settings page:
// the new pipeline (getEnvSettings → mergeSettings with no DB data) is
// compared field by field with a frozen copy of the pre-v1.0 getAppConfig.
import { getEnvSettings } from "@/lib/config";
import { SETTINGS_DEFAULTS, mergeSettings } from "@/lib/settings/merge";

type Env = Record<string, string | undefined>;

// ---- frozen copy of lib/config.ts getAppConfig before v1.0 (do not edit) ----
function legacyClean(raw: string | undefined): string {
  if (raw === undefined) return "";
  const v = raw.trim();
  if (
    v.length >= 2 &&
    ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

function legacyTaxRate(raw: string | undefined): number {
  const s = legacyClean(raw);
  if (s === "") return 5;
  const value = Number(s);
  if (Number.isNaN(value) || value < 0 || value > 100) return 5;
  return value;
}

function legacyGetAppConfig(env: Env) {
  const name = legacyClean(env.COMPANY_NAME) || "Your Company";
  const isDefault = legacyClean(env.COMPANY_NAME) === "";
  const bankName = legacyClean(env.BANK_NAME);
  const accountName = legacyClean(env.BANK_ACCOUNT_NAME);
  const accountNumber = legacyClean(env.BANK_ACCOUNT_NUMBER);
  const payment =
    bankName || accountName || accountNumber ? { bankName, accountName, accountNumber } : null;
  const ccEmails = legacyClean(env.MAIL_CC_EMAILS)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const twVat = legacyClean(env.TW_VAT_LOOKUP).toLowerCase();
  return {
    company: {
      name,
      isDefault,
      nameLocal: legacyClean(env.COMPANY_NAME_LOCAL),
      address: legacyClean(env.COMPANY_ADDRESS),
      vatNumber: legacyClean(env.COMPANY_VAT_NUMBER),
      email: legacyClean(env.COMPANY_EMAIL),
      phone: legacyClean(env.COMPANY_PHONE),
    },
    payment,
    mail: {
      enabled: legacyClean(env.RESEND_API_KEY) !== "",
      apiKey: legacyClean(env.RESEND_API_KEY),
      senderName: legacyClean(env.MAIL_SENDER_NAME) || name,
      senderEmail: legacyClean(env.MAIL_SENDER_EMAIL) || "onboarding@resend.dev",
      ccEmails,
    },
    money: {
      currency: legacyClean(env.CURRENCY) || "TWD",
      currencyLocale: legacyClean(env.CURRENCY_LOCALE) || "zh-TW",
      defaultTaxRate: legacyTaxRate(env.DEFAULT_TAX_RATE),
    },
    features: { twVatLookup: twVat === "1" || twVat === "true" },
  };
}
// ---- end of frozen copy ----

function current(env: Env) {
  const s = mergeSettings(SETTINGS_DEFAULTS, getEnvSettings(env), {});
  return {
    company: {
      name: s.company.name,
      isDefault: s.company.isDefault,
      nameLocal: s.company.nameLocal,
      address: s.company.address,
      vatNumber: s.company.vatNumber,
      email: s.company.email,
      phone: s.company.phone,
    },
    payment: s.payment && {
      bankName: s.payment.bankName,
      accountName: s.payment.accountName,
      accountNumber: s.payment.accountNumber,
    },
    mail: {
      enabled: s.mail.enabled,
      apiKey: s.mail.apiKey,
      senderName: s.mail.senderName,
      senderEmail: s.mail.senderEmail,
      ccEmails: s.mail.ccEmails,
    },
    money: {
      currency: s.money.currency,
      currencyLocale: s.money.currencyLocale,
      defaultTaxRate: s.quote.defaultTaxRate,
    },
    features: s.features,
  };
}

describe("env-only deployments behave exactly as before", () => {
  it.each<[string, Env]>([
    ["nothing set", {}],
    [
      "a typical .env",
      {
        COMPANY_NAME: "Shangda Co., Ltd.",
        COMPANY_NAME_LOCAL: "上達有限公司",
        COMPANY_ADDRESS: "台北市信義區市府路 1 號",
        COMPANY_VAT_NUMBER: "12345678",
        COMPANY_EMAIL: "sales@shangda.test",
        COMPANY_PHONE: "02-2345-6789",
        BANK_NAME: "台灣銀行",
        BANK_ACCOUNT_NAME: "上達有限公司",
        BANK_ACCOUNT_NUMBER: "123-456-789",
        RESEND_API_KEY: "re_123",
        MAIL_SENDER_NAME: "上達業務部",
        MAIL_SENDER_EMAIL: "quotes@shangda.test",
        MAIL_CC_EMAILS: "boss@shangda.test, , acct@shangda.test",
        CURRENCY: "TWD",
        CURRENCY_LOCALE: "zh-TW",
        DEFAULT_TAX_RATE: "5",
        TW_VAT_LOOKUP: "true",
      },
    ],
    ["docker --env-file quotes", { COMPANY_NAME: '"Acme"', MAIL_SENDER_NAME: "'Billing'", RESEND_API_KEY: '""' }],
    ["whitespace only", { COMPANY_NAME: "   ", BANK_NAME: " ", MAIL_SENDER_EMAIL: "  " }],
    ["a single bank field", { BANK_ACCOUNT_NUMBER: "000" }],
    ["tax rate with decimals", { DEFAULT_TAX_RATE: "8.875" }],
    ["tax rate 0", { DEFAULT_TAX_RATE: "0" }],
    ["tax rate out of range", { DEFAULT_TAX_RATE: "101" }],
    ["tax rate not a number", { DEFAULT_TAX_RATE: "5%" }],
    ["USD", { CURRENCY: "USD", CURRENCY_LOCALE: "en-US" }],
    ["JPY", { CURRENCY: "JPY", CURRENCY_LOCALE: "ja-JP" }],
    ["sender name follows the company", { COMPANY_NAME: "Acme" }],
    ...["1", "true", "TRUE", " True ", "0", "false", "yes", "on", "enabled", ""].map(
      (value): [string, Env] => [`TW_VAT_LOOKUP=${JSON.stringify(value)}`, { TW_VAT_LOOKUP: value }]
    ),
  ])("%s", (_label, env) => {
    expect(current(env)).toEqual(legacyGetAppConfig(env));
  });
});
