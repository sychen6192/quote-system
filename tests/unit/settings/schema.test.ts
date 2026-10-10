import {
  isBrandingKind,
  isSettingsSection,
  isSupportedCurrency,
  isSupportedLocale,
  isSupportedTimeZone,
  parseSettingsLayer,
  parseSettingsPatch,
  type SettingsSection,
} from "@/lib/settings/schema";

function errorsOf(section: SettingsSection, data: Record<string, unknown>) {
  const result = parseSettingsPatch(section, data);
  return result.success ? null : result.fieldErrors;
}

function setOf(section: SettingsSection, data: Record<string, unknown>) {
  const result = parseSettingsPatch(section, data);
  if (!result.success) throw new Error(JSON.stringify(result.fieldErrors));
  return result.set;
}

describe("type guards", () => {
  it.each([
    ["company", true],
    ["features", true],
    ["auth", false],
    ["version", false],
    [42, false],
  ])("isSettingsSection(%p) = %p", (value, expected) => {
    expect(isSettingsSection(value)).toBe(expected);
  });

  it.each([
    ["logo", true],
    ["stamp", true],
    ["icon", true],
    ["favicon", false],
    [null, false],
  ])("isBrandingKind(%p) = %p", (value, expected) => {
    expect(isBrandingKind(value)).toBe(expected);
  });
});

describe("Intl-backed validators", () => {
  it.each([
    ["TWD", true],
    ["USD", true],
    ["JPY", true],
    ["usd", false], // the schema upper-cases first
    ["ABC", false], // well-formed but not a currency
    ["US", false],
    ["", false],
  ])("isSupportedCurrency(%p) = %p", (code, expected) => {
    expect(isSupportedCurrency(code)).toBe(expected);
  });

  it.each([
    ["zh-TW", true],
    ["en-US", true],
    ["de", true],
    ["not a locale", false],
    ["", false],
  ])("isSupportedLocale(%p) = %p", (tag, expected) => {
    expect(isSupportedLocale(tag)).toBe(expected);
  });

  it.each([
    ["Asia/Taipei", true],
    ["UTC", true], // alias missing from Intl.supportedValuesOf
    ["America/Argentina/Buenos_Aires", true],
    ["Etc/GMT+8", true],
    ["Mars/Olympus", false],
    ["+08:00", false], // offsets would be POSIX (inverted) in Postgres
    ["", false],
  ])("isSupportedTimeZone(%p) = %p", (zone, expected) => {
    expect(isSupportedTimeZone(zone)).toBe(expected);
  });
});

describe("parseSettingsPatch", () => {
  it("accepts a partial section and trims text", () => {
    expect(setOf("company", { name: "  Acme Ltd.  ", phone: "02-1234" })).toEqual({
      name: "Acme Ltd.",
      phone: "02-1234",
    });
  });

  it("ignores unknown keys (including env-only ones like apiKey)", () => {
    const result = parseSettingsPatch("mail", { apiKey: "re_leak", senderName: "Billing" });
    expect(result).toEqual({ success: true, set: { senderName: "Billing" }, reset: [] });
  });

  it("collects null fields as resets", () => {
    expect(parseSettingsPatch("company", { name: null, address: "", bogus: null })).toEqual({
      success: true,
      set: { address: "" },
      reset: ["name"],
    });
  });

  it.each([null, "x", [], 1])("rejects a non-object payload %p", (data) => {
    expect(parseSettingsPatch("company", data)).toEqual({
      success: false,
      fieldErrors: { _form: ["invalidValue"] },
    });
  });

  it.each<[SettingsSection, Record<string, unknown>, Record<string, string[]>]>([
    ["company", { name: "x".repeat(501) }, { name: ["tooLong"] }], // 500 max
    ["company", { name: "Acme\nEvil" }, { name: ["invalidText"] }],
    // Postgres jsonb rejects \u0000, so it must fail validation, not the save.
    ["company", { name: "Acme\u0000" }, { name: ["invalidText"] }],
    ["company", { phone: "02\u0007" }, { phone: ["invalidText"] }],
    ["company", { address: "1F\u0000\nTaipei" }, { address: ["invalidText"] }],
    ["quote", { defaultNotes: "a\u001bb" }, { defaultNotes: ["invalidText"] }],
    ["company", { email: "nope" }, { email: ["invalidEmail"] }],
    ["company", { website: "not a url" }, { website: ["invalidUrl"] }],
    ["company", { website: "javascript:alert(1).com" }, { website: ["invalidUrl"] }],
    ["company", { website: "ftp://acme.test" }, { website: ["invalidUrl"] }],
    ["company", { website: "acme" }, { website: ["invalidUrl"] }],
    ["company", { vatNumber: 12345678 }, { vatNumber: ["invalidText"] }],
    ["payment", { bankCode: "x".repeat(21) }, { bankCode: ["tooLong"] }],
    ["quote", { numberPattern: "" }, { numberPattern: ["required"] }],
    ["quote", { numberPattern: "QT-{YYYY}" }, { numberPattern: ["invalidNumberPattern"] }],
    ["quote", { numberPattern: "{SEQ}-{SEQ:3}" }, { numberPattern: ["invalidNumberPattern"] }],
    ["quote", { numberPattern: "QT-{FOO}-{SEQ}" }, { numberPattern: ["invalidNumberPattern"] }],
    ["quote", { numberPattern: `${"X".repeat(64)}{SEQ}` }, { numberPattern: ["tooLong"] }],
    ["quote", { validityDays: 0 }, { validityDays: ["validityDaysRange"] }],
    ["quote", { validityDays: 366 }, { validityDays: ["validityDaysRange"] }],
    ["quote", { validityDays: 7.5 }, { validityDays: ["invalidNumber"] }],
    ["quote", { validityDays: "abc" }, { validityDays: ["invalidNumber"] }],
    ["quote", { defaultTaxRate: -1 }, { defaultTaxRate: ["taxRateRange"] }],
    ["quote", { defaultTaxRate: 100.5 }, { defaultTaxRate: ["taxRateRange"] }],
    ["quote", { defaultTaxRate: 5.125 }, { defaultTaxRate: ["tooManyDecimals"] }],
    ["quote", { defaultNotes: "x".repeat(5001) }, { defaultNotes: ["tooLong"] }],
    ["quote", { footerText: "x".repeat(501) }, { footerText: ["tooLong"] }],
    ["quote", { showAmountInWords: "yes" }, { showAmountInWords: ["invalidValue"] }],
    ["money", { currency: "ABC" }, { currency: ["invalidCurrency"] }],
    ["money", { currencyLocale: "not a locale" }, { currencyLocale: ["invalidLocale"] }],
    ["appearance", { brandColor: "#12345" }, { brandColor: ["invalidColor"] }],
    ["appearance", { brandColor: "blue" }, { brandColor: ["invalidColor"] }],
    ["region", { timezone: "Mars/Olympus" }, { timezone: ["invalidTimezone"] }],
    ["mail", { senderEmail: "x@" }, { senderEmail: ["invalidEmail"] }],
    ["mail", { replyTo: "reply" }, { replyTo: ["invalidEmail"] }],
    ["mail", { ccEmails: ["a@x.test", "nope"] }, { "ccEmails.1": ["invalidEmail"] }],
    [
      "mail",
      { ccEmails: ["a@x.te", "b@x.te", "c@x.te", "d@x.te", "e@x.te", "f@x.te"] },
      { ccEmails: ["tooManyRecipients"] },
    ],
    ["features", { twVatLookup: "true" }, { twVatLookup: ["invalidValue"] }],
  ])("%s %j", (section, data, expected) => {
    expect(errorsOf(section, data)).toEqual(expected);
  });

  it.each<[SettingsSection, Record<string, unknown>, Record<string, unknown>]>([
    ["company", { email: "" }, { email: "" }],
    ["company", { website: "https://acme.test/about" }, { website: "https://acme.test/about" }],
    ["company", { website: "acme.com.tw" }, { website: "acme.com.tw" }],
    ["company", { website: "http://shop.acme.test:8080/zh?a=1#x" }, { website: "http://shop.acme.test:8080/zh?a=1#x" }],
    ["company", { website: "https://報價.台灣" }, { website: "https://報價.台灣" }],
    ["company", { address: " 1F, No. 1\r\nTaipei " }, { address: "1F, No. 1\nTaipei" }],
    ["quote", { defaultTerms: "1.\tNet 30\n2.\tFOB" }, { defaultTerms: "1.\tNet 30\n2.\tFOB" }],
    ["quote", { numberPattern: "{ROC}{MM}-{SEQ:4}" }, { numberPattern: "{ROC}{MM}-{SEQ:4}" }],
    ["quote", { validityDays: "14" }, { validityDays: 14 }],
    ["quote", { validityDays: 365 }, { validityDays: 365 }],
    ["quote", { defaultTaxRate: 0 }, { defaultTaxRate: 0 }],
    ["quote", { defaultTaxRate: "8.25" }, { defaultTaxRate: 8.25 }],
    ["quote", { defaultNotes: "x".repeat(5000) }, { defaultNotes: "x".repeat(5000) }],
    ["quote", { showAmountInWords: false }, { showAmountInWords: false }],
    ["money", { currency: " usd " }, { currency: "USD" }],
    ["money", { currencyLocale: "en-US" }, { currencyLocale: "en-US" }],
    ["appearance", { brandColor: "#1d4ed8" }, { brandColor: "#1D4ED8" }],
    ["region", { timezone: "UTC" }, { timezone: "UTC" }],
    ["mail", { ccEmails: "a@x.test, b@y.test;c@z.test" }, { ccEmails: ["a@x.test", "b@y.test", "c@z.test"] }],
    ["mail", { ccEmails: [] }, { ccEmails: [] }],
    ["mail", { replyTo: "" }, { replyTo: "" }],
    ["features", { twVatLookup: true }, { twVatLookup: true }],
  ])("%s %j is accepted", (section, data, expected) => {
    expect(setOf(section, data)).toEqual(expected);
  });
});

describe("parseSettingsLayer", () => {
  it("keeps valid fields and drops invalid / unknown / null ones", () => {
    expect(
      parseSettingsLayer({
        company: { name: "Acme", email: "broken", unknown: 1, phone: null },
        quote: { validityDays: 9999, defaultTaxRate: 8 },
        appearance: { brandColor: "#abcdef" },
        bogus: { x: 1 },
        mail: "not an object",
      })
    ).toEqual({
      company: { name: "Acme" },
      quote: { defaultTaxRate: 8 },
      appearance: { brandColor: "#ABCDEF" },
    });
  });

  it.each([null, undefined, "x", [], 5])("returns an empty layer for %p", (data) => {
    expect(parseSettingsLayer(data)).toEqual({});
  });

  it("keeps empty strings (a saved 'hide this')", () => {
    expect(parseSettingsLayer({ company: { address: "" } })).toEqual({
      company: { address: "" },
    });
  });
});
