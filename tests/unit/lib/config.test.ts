import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  getAppConfig,
  toPublicConfig,
  getBrandingDataUri,
} from "@/lib/config";

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
      currency: "TWD",
      currencyLocale: "zh-TW",
      defaultTaxRate: 5,
      twVatLookup: false,
    });
    expect(JSON.stringify(pub)).not.toContain("secret-999");
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
