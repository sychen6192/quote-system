import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  getAppConfig,
  getAppNameOverride,
  getEnvSettings,
  toPublicConfig,
  getBrandingDataUri,
} from "@/lib/config";
import { pickCompanyName } from "@/lib/company-name";

// 1x1 transparent PNG
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

describe("getAppConfig", () => {
  it("returns placeholder defaults when no env vars are set", () => {
    const config = getAppConfig({});
    expect(config.company.name).toBe("Your Company");
    expect(config.company.isDefault).toBe(true);
    expect(config.company.nameLocal).toBe("");
    expect(config.company.address).toBe("");
    expect(config.company.vatNumber).toBe("");
    expect(config.company.email).toBe("");
    expect(config.company.phone).toBe("");
    expect(config.payment).toBeNull();
    expect(config.mail.enabled).toBe(false);
    expect(config.mail.senderName).toBe("Your Company");
    expect(config.mail.senderEmail).toBe("onboarding@resend.dev");
    expect(config.mail.ccEmails).toEqual([]);
    expect(config.money).toEqual({
      currency: "TWD",
      currencyLocale: "zh-TW",
      defaultTaxRate: 5,
    });
  });

  it("maps all env vars when set", () => {
    const config = getAppConfig({
      COMPANY_NAME: "Acme Ltd.",
      COMPANY_NAME_LOCAL: "頂尖有限公司",
      COMPANY_ADDRESS: "1 Main St",
      COMPANY_VAT_NUMBER: "12345678",
      COMPANY_EMAIL: "hi@acme.test",
      COMPANY_PHONE: "+886 900 000 000",
      BANK_NAME: "Bank",
      BANK_ACCOUNT_NAME: "Acme",
      BANK_ACCOUNT_NUMBER: "000-111",
      MAIL_SENDER_NAME: "Acme Billing",
      MAIL_SENDER_EMAIL: "billing@acme.test",
      MAIL_CC_EMAILS: " a@x.test, b@y.test ,,",
      RESEND_API_KEY: "re_test",
      CURRENCY: "USD",
      CURRENCY_LOCALE: "en-US",
      DEFAULT_TAX_RATE: "8.25",
    });
    expect(config.company.name).toBe("Acme Ltd.");
    expect(config.company.isDefault).toBe(false);
    expect(config.company.nameLocal).toBe("頂尖有限公司");
    expect(config.payment).toEqual({
      bankName: "Bank",
      bankCode: "",
      accountName: "Acme",
      accountNumber: "000-111",
    });
    expect(config.mail.enabled).toBe(true);
    expect(config.mail.senderName).toBe("Acme Billing");
    expect(config.mail.senderEmail).toBe("billing@acme.test");
    expect(config.mail.ccEmails).toEqual(["a@x.test", "b@y.test"]);
    expect(config.money).toEqual({
      currency: "USD",
      currencyLocale: "en-US",
      defaultTaxRate: 8.25,
    });
  });

  it("strips surrounding quotes (docker --env-file keeps them literally)", () => {
    const config = getAppConfig({
      COMPANY_NAME: '"Shangda Intl."',
      COMPANY_ADDRESS: "'123 Main St'",
      CURRENCY: '"USD"',
      CURRENCY_LOCALE: '"en-US"',
      DEFAULT_TAX_RATE: '"8"',
      RESEND_API_KEY: '""', // quoted-empty must count as unset
      MAIL_CC_EMAILS: '"a@x.test, b@y.test"',
    });
    expect(config.company.name).toBe("Shangda Intl.");
    expect(config.company.isDefault).toBe(false);
    expect(config.company.address).toBe("123 Main St");
    expect(config.money.currency).toBe("USD");
    expect(config.money.currencyLocale).toBe("en-US");
    expect(config.money.defaultTaxRate).toBe(8);
    expect(config.mail.enabled).toBe(false);
    expect(config.mail.ccEmails).toEqual(["a@x.test", "b@y.test"]);
  });

  it("exposes the API key with surrounding quotes stripped", () => {
    // docker --env-file keeps quotes literally; Resend rejects a quoted key
    // with 400 "API key is invalid", so the key must be cleaned like the rest.
    expect(getAppConfig({ RESEND_API_KEY: '"re_abc123"' }).mail.apiKey).toBe(
      "re_abc123"
    );
    expect(getAppConfig({ RESEND_API_KEY: "re_abc123" }).mail.apiKey).toBe(
      "re_abc123"
    );
    expect(getAppConfig({}).mail.apiKey).toBe("");
  });

  it("defaults twVatLookup to false", () => {
    expect(getAppConfig({}).features.twVatLookup).toBe(false);
  });

  it("enables twVatLookup when TW_VAT_LOOKUP is truthy", () => {
    expect(getAppConfig({ TW_VAT_LOOKUP: "1" }).features.twVatLookup).toBe(true);
    expect(getAppConfig({ TW_VAT_LOOKUP: "true" }).features.twVatLookup).toBe(
      true
    );
    expect(getAppConfig({ TW_VAT_LOOKUP: "0" }).features.twVatLookup).toBe(
      false
    );
    expect(getAppConfig({ TW_VAT_LOOKUP: "" }).features.twVatLookup).toBe(false);
  });

  it("keeps payment non-null when only some bank fields are set", () => {
    const config = getAppConfig({ BANK_NAME: "Bank" });
    expect(config.payment).toEqual({
      bankName: "Bank",
      bankCode: "",
      accountName: "",
      accountNumber: "",
    });
  });

  it("falls back MAIL_SENDER_NAME to company name", () => {
    const config = getAppConfig({
      COMPANY_NAME: "Acme Ltd.",
    });
    expect(config.mail.senderName).toBe("Acme Ltd.");
  });

  it.each([["abc"], ["-1"], ["101"], [""]])(
    "falls back DEFAULT_TAX_RATE to 5 for invalid value %p",
    (value) => {
      const config = getAppConfig({
        DEFAULT_TAX_RATE: value,
      });
      expect(config.money.defaultTaxRate).toBe(5);
    }
  );
});

describe("getAppConfig — v1.0 env vars", () => {
  it("defaults the new fields", () => {
    const config = getAppConfig({});
    expect(config.appName).toBe("");
    expect(config.company.website).toBe("");
    expect(config.mail.replyTo).toBe("");
    expect(config.quote).toEqual({
      numberPattern: "QT-{YYYY}{MM}{DD}-{SEQ:3}",
      validityDays: 30,
      defaultNotes: "",
      defaultTerms: "",
    });
    expect(config.appearance).toEqual({ brandColor: "#1D4ED8" });
    expect(config.region).toEqual({ timezone: "Asia/Taipei" });
  });

  it("maps APP_NAME, COMPANY_WEBSITE, BANK_CODE, MAIL_REPLY_TO and quote defaults", () => {
    const config = getAppConfig({
      APP_NAME: '"Acme Quotes"',
      COMPANY_WEBSITE: "https://acme.test",
      BANK_CODE: "812",
      MAIL_REPLY_TO: "sales@acme.test",
      QUOTE_NUMBER_PATTERN: "ACME-{ROC}{MM}-{SEQ:4}",
      QUOTE_VALIDITY_DAYS: "45",
      DEFAULT_NOTES: "Prices exclude shipping.\\nThank you!",
      DEFAULT_TERMS: "Net 30",
      BRAND_COLOR: "#0F766E",
      APP_TIMEZONE: "Asia/Tokyo",
    });
    expect(config.appName).toBe("Acme Quotes");
    expect(config.company.website).toBe("https://acme.test");
    expect(config.payment).toEqual({
      bankName: "",
      bankCode: "812",
      accountName: "",
      accountNumber: "",
    });
    expect(config.mail.replyTo).toBe("sales@acme.test");
    expect(config.quote).toEqual({
      numberPattern: "ACME-{ROC}{MM}-{SEQ:4}",
      validityDays: 45,
      defaultNotes: "Prices exclude shipping.\nThank you!",
      defaultTerms: "Net 30",
    });
    expect(config.appearance.brandColor).toBe("#0F766E");
    expect(config.region.timezone).toBe("Asia/Tokyo");
  });

  it.each<[Record<string, string>, string]>([
    [{}, "Asia/Taipei"],
    [{ TZ: "Europe/Berlin" }, "Europe/Berlin"],
    [{ TZ: "Europe/Berlin", APP_TIMEZONE: "UTC" }, "UTC"],
    [{ APP_TIMEZONE: "Not/AZone", TZ: "Europe/Berlin" }, "Europe/Berlin"],
    [{ APP_TIMEZONE: "+08:00" }, "Asia/Taipei"],
    [{ TZ: ":/etc/localtime" }, "Asia/Taipei"],
  ])("timezone from %p is %p", (env, expected) => {
    expect(getAppConfig(env).region.timezone).toBe(expected);
  });

  it.each([["0"], ["366"], ["7.5"], ["abc"]])(
    "falls back QUOTE_VALIDITY_DAYS to 30 for %p",
    (value) => {
      expect(getAppConfig({ QUOTE_VALIDITY_DAYS: value }).quote.validityDays).toBe(30);
    }
  );

  it.each([["no-seq"], ["{SEQ}{SEQ}"], ["{BAD}-{SEQ}"]])(
    "ignores an invalid QUOTE_NUMBER_PATTERN %p",
    (value) => {
      expect(getAppConfig({ QUOTE_NUMBER_PATTERN: value }).quote.numberPattern).toBe(
        "QT-{YYYY}{MM}{DD}-{SEQ:3}"
      );
    }
  );

  it("ignores a COMPANY_WEBSITE that is not an http(s) site", () => {
    expect(getAppConfig({ COMPANY_WEBSITE: "javascript:alert(1).com" }).company.website).toBe("");
  });

  it.each([["#12345"], ["blue"], ["#GGGGGG"]])("ignores an invalid BRAND_COLOR %p", (value) => {
    expect(getAppConfig({ BRAND_COLOR: value }).appearance.brandColor).toBe("#1D4ED8");
  });

  it("upper-cases the currency and ignores an unsupported currency locale", () => {
    const config = getAppConfig({ CURRENCY: "usd", CURRENCY_LOCALE: "not a locale" });
    expect(config.money.currency).toBe("USD");
    expect(config.money.currencyLocale).toBe("zh-TW");
  });
});

describe("getEnvSettings", () => {
  it("only contains the variables that are set", () => {
    expect(getEnvSettings({ COMPANY_NAME: "Acme", BANK_CODE: " " })).toEqual({
      layer: {
        company: { name: "Acme" },
        payment: undefined,
        quote: undefined,
        money: undefined,
        appearance: undefined,
        region: undefined,
        mail: undefined,
        features: undefined,
      },
      apiKey: "",
      authEnabled: false,
    });
  });

  it("treats TW_VAT_LOOKUP=0 as an explicit false and APP_PASSWORD as auth", () => {
    const env = getEnvSettings({ TW_VAT_LOOKUP: "0", APP_PASSWORD: "'pw'" });
    expect(env.layer.features).toEqual({ twVatLookup: false });
    expect(env.authEnabled).toBe(true);
  });

  it("getAppNameOverride strips quotes", () => {
    expect(getAppNameOverride({ APP_NAME: "'Acme'" })).toBe("Acme");
    expect(getAppNameOverride({})).toBe("");
  });
});

describe("toPublicConfig", () => {
  it("exposes only client-safe fields", () => {
    const pub = toPublicConfig(
      getAppConfig({
        COMPANY_NAME: "Acme Ltd.",
        BANK_ACCOUNT_NUMBER: "secret-999",
      })
    );
    expect(pub).toEqual({
      companyName: "Acme Ltd.",
      companyNameLocal: "",
      currency: "TWD",
      currencyLocale: "zh-TW",
      defaultTaxRate: 5,
      twVatLookup: false,
    });
    expect(JSON.stringify(pub)).not.toContain("secret-999");
  });
});

describe("pickCompanyName", () => {
  it("uses the local name for Chinese locales when set", () => {
    expect(pickCompanyName("Acme Ltd.", "頂尖公司", "zh-TW")).toBe("頂尖公司");
    expect(pickCompanyName("Acme Ltd.", "頂尖公司", "zh")).toBe("頂尖公司");
  });

  it("uses the main name for non-Chinese locales", () => {
    expect(pickCompanyName("Acme Ltd.", "頂尖公司", "en")).toBe("Acme Ltd.");
    expect(pickCompanyName("Acme Ltd.", "頂尖公司", "ja")).toBe("Acme Ltd.");
  });

  it("falls back to the main name when no local name is set", () => {
    expect(pickCompanyName("Acme Ltd.", "", "zh-TW")).toBe("Acme Ltd.");
    expect(pickCompanyName("Acme Ltd.", "   ", "zh-TW")).toBe("Acme Ltd.");
  });
});

describe("getBrandingDataUri", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "branding-test-"));
    fs.mkdirSync(path.join(dir, "branding"));
    fs.mkdirSync(path.join(dir, "branding-defaults"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("prefers user logo over default", () => {
    fs.writeFileSync(path.join(dir, "branding", "logo.png"), TINY_PNG);
    fs.writeFileSync(
      path.join(dir, "branding-defaults", "logo.png"),
      Buffer.from("not-used")
    );
    expect(getBrandingDataUri("logo", dir)).toBe(
      `data:image/png;base64,${TINY_PNG.toString("base64")}`
    );
  });

  it("falls back logo to branding-defaults", () => {
    fs.writeFileSync(path.join(dir, "branding-defaults", "logo.png"), TINY_PNG);
    expect(getBrandingDataUri("logo", dir)).toBe(
      `data:image/png;base64,${TINY_PNG.toString("base64")}`
    );
  });

  it("returns null for missing stamp (no default)", () => {
    expect(getBrandingDataUri("stamp", dir)).toBeNull();
  });

  it("falls back icon to logo then default logo", () => {
    fs.writeFileSync(path.join(dir, "branding-defaults", "logo.png"), TINY_PNG);
    expect(getBrandingDataUri("icon", dir)).toBe(
      `data:image/png;base64,${TINY_PNG.toString("base64")}`
    );
  });
});
