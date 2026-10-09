import { getAppConfig, getEnvSettings } from "@/lib/config";
import {
  DEFAULT_SENDER_EMAIL,
  SETTINGS_DEFAULTS,
  hashString,
  mergeSettings,
  type EnvSettings,
} from "@/lib/settings/merge";
import type { EffectiveSettings } from "@/lib/settings/types";

type Env = Record<string, string | undefined>;

const merge = (env: Env = {}, db: unknown = {}, meta = {}) =>
  mergeSettings(SETTINGS_DEFAULTS, getEnvSettings(env), db, meta);

const FULL_ENV: Env = {
  COMPANY_NAME: "Acme Ltd.",
  COMPANY_NAME_LOCAL: "頂尖有限公司",
  COMPANY_ADDRESS: "1 Main St",
  COMPANY_VAT_NUMBER: "12345678",
  COMPANY_EMAIL: "hi@acme.test",
  COMPANY_PHONE: "+886 900 000 000",
  COMPANY_WEBSITE: "acme.test",
  BANK_NAME: "Bank",
  BANK_CODE: "812",
  BANK_ACCOUNT_NAME: "Acme",
  BANK_ACCOUNT_NUMBER: "000-111",
  MAIL_SENDER_NAME: "Acme Billing",
  MAIL_SENDER_EMAIL: "billing@acme.test",
  MAIL_CC_EMAILS: "a@x.test,b@y.test",
  MAIL_REPLY_TO: "sales@acme.test",
  RESEND_API_KEY: "re_test",
  CURRENCY: "USD",
  CURRENCY_LOCALE: "en-US",
  DEFAULT_TAX_RATE: "8.25",
  QUOTE_NUMBER_PATTERN: "A-{YY}{MM}-{SEQ:4}",
  QUOTE_VALIDITY_DAYS: "14",
  DEFAULT_NOTES: "Line 1\\nLine 2",
  DEFAULT_TERMS: "Net 30",
  BRAND_COLOR: "#0f766e",
  APP_TIMEZONE: "America/New_York",
  TW_VAT_LOOKUP: "true",
  APP_PASSWORD: "pw",
};

describe("mergeSettings — env only (existing deployments)", () => {
  it("uses the built-in defaults when nothing is configured", () => {
    const s = merge();
    expect(s).toEqual<EffectiveSettings>({
      company: {
        name: "Your Company",
        nameLocal: "",
        address: "",
        vatNumber: "",
        email: "",
        phone: "",
        website: "",
        isDefault: true,
      },
      payment: null,
      quote: {
        numberPattern: "QT-{YYYY}{MM}{DD}-{SEQ:3}",
        validityDays: 30,
        defaultTaxRate: 5,
        defaultNotes: "",
        defaultTerms: "",
        defaultSalesperson: "",
        showAmountInWords: true,
        footerText: "",
      },
      money: { currency: "TWD", currencyLocale: "zh-TW", fractionDigits: 0 },
      appearance: { brandColor: "#1D4ED8" },
      region: { timezone: "Asia/Taipei" },
      mail: {
        enabled: false,
        apiKey: "",
        senderName: "Your Company",
        senderEmail: DEFAULT_SENDER_EMAIL,
        ccEmails: [],
        replyTo: "",
      },
      features: { twVatLookup: false },
      auth: { enabled: false },
      version: expect.any(String),
    });
  });

  it("maps every env var", () => {
    const s = merge(FULL_ENV);
    expect(s.company).toEqual({
      name: "Acme Ltd.",
      nameLocal: "頂尖有限公司",
      address: "1 Main St",
      vatNumber: "12345678",
      email: "hi@acme.test",
      phone: "+886 900 000 000",
      website: "acme.test",
      isDefault: false,
    });
    expect(s.payment).toEqual({
      bankName: "Bank",
      bankCode: "812",
      accountName: "Acme",
      accountNumber: "000-111",
    });
    expect(s.quote).toEqual({
      numberPattern: "A-{YY}{MM}-{SEQ:4}",
      validityDays: 14,
      defaultTaxRate: 8.25,
      defaultNotes: "Line 1\nLine 2",
      defaultTerms: "Net 30",
      defaultSalesperson: "",
      showAmountInWords: false, // USD
      footerText: "",
    });
    expect(s.money).toEqual({ currency: "USD", currencyLocale: "en-US", fractionDigits: 2 });
    expect(s.appearance.brandColor).toBe("#0F766E");
    expect(s.region.timezone).toBe("America/New_York");
    expect(s.mail).toEqual({
      enabled: true,
      apiKey: "re_test",
      senderName: "Acme Billing",
      senderEmail: "billing@acme.test",
      ccEmails: ["a@x.test", "b@y.test"],
      replyTo: "sales@acme.test",
    });
    expect(s.features.twVatLookup).toBe(true);
    expect(s.auth.enabled).toBe(true);
  });

  it.each<[string, Env]>([
    ["empty", {}],
    ["full", FULL_ENV],
    ["quoted values", { COMPANY_NAME: '"Shangda"', CURRENCY: "'JPY'", RESEND_API_KEY: '""' }],
    ["partial bank", { BANK_NAME: "Bank" }],
    ["invalid numbers", { DEFAULT_TAX_RATE: "abc", QUOTE_VALIDITY_DAYS: "0" }],
  ])("agrees with getAppConfig for %s env", (_label, env) => {
    const s = merge(env);
    const legacy = getAppConfig(env);
    expect(legacy.company).toEqual(s.company);
    expect(legacy.payment).toEqual(s.payment);
    expect(legacy.mail).toEqual({
      enabled: s.mail.enabled,
      apiKey: s.mail.apiKey,
      senderName: s.mail.senderName,
      senderEmail: s.mail.senderEmail,
      ccEmails: s.mail.ccEmails,
      replyTo: s.mail.replyTo,
    });
    expect(legacy.money).toEqual({
      currency: s.money.currency,
      currencyLocale: s.money.currencyLocale,
      defaultTaxRate: s.quote.defaultTaxRate,
    });
    expect(legacy.features).toEqual(s.features);
  });
});

describe("mergeSettings — precedence DB > env > default", () => {
  it.each<[string, Env, unknown, (s: EffectiveSettings) => unknown, unknown]>([
    ["default", {}, {}, (s) => s.company.address, ""],
    ["env", { COMPANY_ADDRESS: "Env St" }, {}, (s) => s.company.address, "Env St"],
    ["db over env", { COMPANY_ADDRESS: "Env St" }, { company: { address: "DB Rd" } }, (s) => s.company.address, "DB Rd"],
    ["db only", {}, { company: { address: "DB Rd" } }, (s) => s.company.address, "DB Rd"],
    ["saved '' hides an env value", { COMPANY_ADDRESS: "Env St" }, { company: { address: "" } }, (s) => s.company.address, ""],
    ["saved '' name falls back to env", { COMPANY_NAME: "Env Co" }, { company: { name: "" } }, (s) => s.company.name, "Env Co"],
    ["saved '' name falls back to default", {}, { company: { name: "" } }, (s) => s.company.name, "Your Company"],
    ["db pattern", { QUOTE_NUMBER_PATTERN: "E-{SEQ}" }, { quote: { numberPattern: "D-{SEQ}" } }, (s) => s.quote.numberPattern, "D-{SEQ}"],
    ["invalid env pattern ignored", { QUOTE_NUMBER_PATTERN: "no-seq" }, {}, (s) => s.quote.numberPattern, "QT-{YYYY}{MM}{DD}-{SEQ:3}"],
    ["invalid db value ignored", { DEFAULT_TAX_RATE: "8" }, { quote: { defaultTaxRate: 900 } }, (s) => s.quote.defaultTaxRate, 8],
    ["db 0 % tax is a value", { DEFAULT_TAX_RATE: "8" }, { quote: { defaultTaxRate: 0 } }, (s) => s.quote.defaultTaxRate, 0],
    ["db validity days", { QUOTE_VALIDITY_DAYS: "14" }, { quote: { validityDays: 60 } }, (s) => s.quote.validityDays, 60],
    ["db brand colour", { BRAND_COLOR: "0f766e" }, { appearance: { brandColor: "#b91c1c" } }, (s) => s.appearance.brandColor, "#B91C1C"],
    ["env colour without #", { BRAND_COLOR: "0f766e" }, {}, (s) => s.appearance.brandColor, "#0F766E"],
    ["db timezone", { APP_TIMEZONE: "UTC" }, { region: { timezone: "Asia/Tokyo" } }, (s) => s.region.timezone, "Asia/Tokyo"],
    ["TZ fallback", { TZ: "Europe/Berlin" }, {}, (s) => s.region.timezone, "Europe/Berlin"],
    ["APP_TIMEZONE over TZ", { TZ: "Europe/Berlin", APP_TIMEZONE: "UTC" }, {}, (s) => s.region.timezone, "UTC"],
    ["bad TZ ignored", { TZ: ":/etc/localtime" }, {}, (s) => s.region.timezone, "Asia/Taipei"],
    ["db twVatLookup false over env true", { TW_VAT_LOOKUP: "1" }, { features: { twVatLookup: false } }, (s) => s.features.twVatLookup, false],
    ["db cc [] hides env list", { MAIL_CC_EMAILS: "a@x.test" }, { mail: { ccEmails: [] } }, (s) => s.mail.ccEmails, []],
    ["db sender '' falls back to env", { MAIL_SENDER_EMAIL: "e@x.test" }, { mail: { senderEmail: "" } }, (s) => s.mail.senderEmail, "e@x.test"],
    ["sender name follows db company name", {}, { company: { name: "DB Co" } }, (s) => s.mail.senderName, "DB Co"],
    ["db sender name", { MAIL_SENDER_NAME: "Env" }, { mail: { senderName: "DB" } }, (s) => s.mail.senderName, "DB"],
    ["apiKey is env-only", {}, { mail: { apiKey: "re_db" } }, (s) => [s.mail.enabled, s.mail.apiKey], [false, ""]],
  ])("%s", (_label, env, db, select, expected) => {
    expect(select(merge(env, db))).toEqual(expected);
  });

  it.each<[string, Env, unknown, boolean]>([
    ["nothing set", {}, {}, true],
    ["env name", { COMPANY_NAME: "Acme" }, {}, false],
    ["db name", {}, { company: { name: "Acme" } }, false],
    ["db '' with env name", { COMPANY_NAME: "Acme" }, { company: { name: "" } }, false],
    ["only a local name", { COMPANY_NAME_LOCAL: "頂尖" }, {}, true],
  ])("company.isDefault: %s", (_label, env, db, expected) => {
    expect(merge(env, db).company.isDefault).toBe(expected);
  });
});

describe("mergeSettings — derived fields", () => {
  it.each<[string, Env, unknown, EffectiveSettings["payment"]]>([
    ["all empty → null", {}, {}, null],
    ["env bank code only", { BANK_CODE: "812" }, {}, { bankName: "", bankCode: "812", accountName: "", accountNumber: "" }],
    [
      "mixed sources",
      { BANK_NAME: "Env Bank" },
      { payment: { accountNumber: "123" } },
      { bankName: "Env Bank", bankCode: "", accountName: "", accountNumber: "123" },
    ],
    [
      "db clears every env value → null",
      { BANK_NAME: "Env Bank", BANK_ACCOUNT_NUMBER: "1" },
      { payment: { bankName: "", accountNumber: "" } },
      null,
    ],
  ])("payment: %s", (_label, env, db, expected) => {
    expect(merge(env, db).payment).toEqual(expected);
  });

  it.each<[string, number]>([
    ["TWD", 0],
    ["JPY", 0],
    ["KRW", 0],
    ["VND", 0],
    ["HUF", 0],
    ["USD", 2],
    ["EUR", 2],
    ["BHD", 3],
  ])("fractionDigits for %s = %d", (currency, digits) => {
    expect(merge({}, { money: { currency } }).money.fractionDigits).toBe(digits);
  });

  it.each<[string, Env, unknown, boolean]>([
    ["TWD default", {}, {}, true],
    ["USD from env", { CURRENCY: "USD" }, {}, false],
    ["USD from db", {}, { money: { currency: "USD" } }, false],
    ["TWD but turned off", {}, { quote: { showAmountInWords: false } }, false],
    ["USD but turned on", { CURRENCY: "USD" }, { quote: { showAmountInWords: true } }, true],
  ])("showAmountInWords: %s", (_label, env, db, expected) => {
    expect(merge(env, db).quote.showAmountInWords).toBe(expected);
  });
});

describe("version", () => {
  const env: EnvSettings = getEnvSettings({ COMPANY_NAME: "Acme" });
  const base = (meta = {}, db: unknown = {}, e = env) => mergeSettings(SETTINGS_DEFAULTS, e, db, meta).version;

  it("is stable for the same inputs", () => {
    const meta = { updatedAt: new Date("2026-10-09T00:00:00Z"), brandingStamps: { "db:logo": "a" } };
    expect(base(meta)).toBe(base({ ...meta, updatedAt: "2026-10-09T00:00:00.000Z" }));
  });

  it("ignores the order of branding stamps", () => {
    expect(base({ brandingStamps: { a: "1", b: "2" } })).toBe(base({ brandingStamps: { b: "2", a: "1" } }));
  });

  it.each<[string, () => string]>([
    ["settings saved", () => base({ updatedAt: "2026-10-09T01:00:00Z" })],
    ["logo uploaded", () => base({ brandingStamps: { "db:logo": "2026-10-09T01:00:00Z" } })],
    ["branding file swapped", () => base({ brandingStamps: { "file:branding/logo.png": "123:456" } })],
    ["effective value changed (env)", () => base({}, {}, getEnvSettings({ COMPANY_NAME: "Other" }))],
    ["effective value changed (db)", () => base({}, { appearance: { brandColor: "#000000" } })],
  ])("changes when %s", (_label, changed) => {
    expect(changed()).not.toBe(base());
  });

  it("does not depend on the API key value (never leaks it)", () => {
    const a = getEnvSettings({ COMPANY_NAME: "Acme", RESEND_API_KEY: "re_a" });
    const b = getEnvSettings({ COMPANY_NAME: "Acme", RESEND_API_KEY: "re_b" });
    expect(base({}, {}, a)).toBe(base({}, {}, b));
    expect(base({}, {}, a)).not.toContain("re_a");
  });

  it("hashString is deterministic and short", () => {
    expect(hashString("abc")).toBe(hashString("abc"));
    expect(hashString("abc")).not.toBe(hashString("abd"));
    expect(hashString("abc")).toMatch(/^[0-9a-z]{1,11}$/);
  });
});
