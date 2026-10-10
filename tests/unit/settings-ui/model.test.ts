import { getEnvSettings } from "@/lib/config";
import { BLANK_IS_A_VALUE, SETTINGS_DEFAULTS, mergeSettings, settingSource } from "@/lib/settings/merge";
import {
  parseSettingsLayer,
  settingsSectionSchemas,
  SETTINGS_SECTIONS,
  type SettingsLayer,
  type SettingsSection,
} from "@/lib/settings/schema";
import type { EffectiveSettings } from "@/lib/settings/types";
import {
  buildSectionPatch,
  changedKeys,
  ENV_VARS,
  formFieldOfErrorPath,
  resolveSettingsFields,
  tabFromHash,
} from "@/components/settings/model";

function allDefaults(showAmountInWords: boolean) {
  const out = {} as Record<SettingsSection, Record<string, unknown>>;
  for (const section of SETTINGS_SECTIONS) {
    out[section] = { ...(SETTINGS_DEFAULTS[section] as Record<string, unknown>) };
  }
  out.quote.showAmountInWords = showAmountInWords;
  return out;
}

/** The effective value of a field as mergeSettings exposes it. */
function effectiveField(s: EffectiveSettings, section: SettingsSection, key: string): unknown {
  switch (section) {
    case "company":
      return (s.company as Record<string, unknown>)[key];
    case "payment":
      return s.payment ? (s.payment as Record<string, unknown>)[key] : "";
    case "quote":
      return (s.quote as Record<string, unknown>)[key];
    case "money":
      return (s.money as Record<string, unknown>)[key];
    case "appearance":
      return s.appearance.brandColor;
    case "region":
      return s.region.timezone;
    case "mail":
      return (s.mail as Record<string, unknown>)[key];
    case "features":
      return s.features.twVatLookup;
  }
}

const FULL_ENV = {
  COMPANY_NAME: "Env Co.",
  COMPANY_NAME_LOCAL: "環境公司",
  COMPANY_ADDRESS: "Env street 1",
  COMPANY_VAT_NUMBER: "12345678",
  COMPANY_EMAIL: "env@example.com",
  COMPANY_PHONE: "02-1234-5678",
  COMPANY_WEBSITE: "https://env.example.com",
  BANK_NAME: "Env Bank",
  BANK_CODE: "007",
  BANK_ACCOUNT_NAME: "Env Co.",
  BANK_ACCOUNT_NUMBER: "123-456",
  QUOTE_NUMBER_PATTERN: "E-{YYYY}-{SEQ:4}",
  QUOTE_VALIDITY_DAYS: "45",
  DEFAULT_TAX_RATE: "10",
  DEFAULT_NOTES: "env notes",
  DEFAULT_TERMS: "env terms",
  CURRENCY: "USD",
  CURRENCY_LOCALE: "en-US",
  BRAND_COLOR: "#0F766E",
  APP_TIMEZONE: "Asia/Tokyo",
  MAIL_SENDER_NAME: "Env Sender",
  MAIL_SENDER_EMAIL: "sender@env.example.com",
  MAIL_CC_EMAILS: "a@env.example.com,b@env.example.com",
  MAIL_REPLY_TO: "reply@env.example.com",
  TW_VAT_LOOKUP: "true",
};

// Every field saved as blank: blank-is-a-value fields must win over env, the
// others must fall back to env. This pins the copy of BLANK_IS_A_VALUE.
function blankStored(): Record<string, Record<string, unknown>> {
  const stored: Record<string, Record<string, unknown>> = {};
  for (const section of SETTINGS_SECTIONS) {
    const shape = settingsSectionSchemas[section].shape as Record<string, unknown>;
    stored[section] = {};
    for (const key of Object.keys(shape)) {
      const sample = (SETTINGS_DEFAULTS[section] as Record<string, unknown>)[key];
      if (typeof sample === "string") stored[section][key] = "";
      if (Array.isArray(sample)) stored[section][key] = [];
    }
  }
  return stored;
}

function resolveLike(env: Record<string, string>, stored: unknown) {
  const envSettings = getEnvSettings(env);
  const effective = mergeSettings(SETTINGS_DEFAULTS, envSettings, stored);
  const db: SettingsLayer = parseSettingsLayer(stored);
  const resolved = resolveSettingsFields(
    allDefaults(effective.money.currency === "TWD"),
    envSettings.layer,
    db
  );
  return { effective, resolved };
}

describe("resolveSettingsFields", () => {
  it.each([
    ["no env, nothing stored", {}, {}],
    ["full env, nothing stored", FULL_ENV, {}],
    ["full env, every text field saved blank", FULL_ENV, blankStored()],
    ["no env, every text field saved blank", {}, blankStored()],
    [
      "env + saved values",
      FULL_ENV,
      {
        company: { name: "Saved Co.", vatNumber: "" },
        quote: { validityDays: 14, showAmountInWords: false },
        money: { currency: "JPY" },
        mail: { ccEmails: [], senderName: "" },
        features: { twVatLookup: false },
      },
    ],
  ])("agrees with mergeSettings: %s", (_name, env, stored) => {
    const { effective, resolved } = resolveLike(env as Record<string, string>, stored);
    for (const section of SETTINGS_SECTIONS) {
      for (const key of Object.keys(settingsSectionSchemas[section].shape)) {
        const value = resolved.values[section][key];
        let expected = effectiveField(effective, section, key);
        // The effective sender name falls back to the company name.
        if (section === "mail" && key === "senderName" && value === "") {
          expect(expected).toBe(effective.company.name);
          continue;
        }
        if (section === "money" && key === "currency") expected = String(expected);
        expect({ section, key, value }).toEqual({ section, key, value: expected });
      }
    }
  });

  it("reports provenance and the reset fallback", () => {
    const { resolved } = resolveLike(FULL_ENV, {
      company: { name: "Saved Co.", nameLocal: "" },
      quote: { footerText: "Thanks" },
    });
    expect(resolved.meta.company.name).toEqual({
      source: "db",
      fallback: "Env Co.",
      fallbackSource: "env",
      envVar: "COMPANY_NAME",
    });
    // A blank local name is a saved value (hidden), not a fallback.
    expect(resolved.meta.company.nameLocal.source).toBe("db");
    expect(resolved.values.company.nameLocal).toBe("");
    expect(resolved.meta.company.address.source).toBe("env");
    expect(resolved.meta.quote.footerText).toMatchObject({
      source: "db",
      fallback: "",
      fallbackSource: "default",
      envVar: null,
    });
    expect(resolved.meta.quote.defaultSalesperson.source).toBe("default");
  });

  it("reports the source getSettings() itself uses (lib/settings/merge settingSource)", () => {
    for (const stored of [{}, blankStored()]) {
      const envSettings = getEnvSettings(FULL_ENV);
      const db = parseSettingsLayer(stored);
      const { resolved } = resolveLike(FULL_ENV, stored);
      for (const section of SETTINGS_SECTIONS) {
        for (const key of Object.keys(resolved.meta[section])) {
          expect({ section, key, source: resolved.meta[section][key].source }).toEqual({
            section,
            key,
            source: settingSource(section, key, envSettings.layer, db),
          });
        }
      }
    }
  });

  it("names an env var for every field the env layer can set", () => {
    const layer = getEnvSettings(FULL_ENV).layer;
    for (const section of SETTINGS_SECTIONS) {
      for (const key of Object.keys(layer[section] ?? {})) {
        expect({ section, key, envVar: ENV_VARS[section][key] }).toEqual({
          section,
          key,
          envVar: expect.any(String),
        });
      }
    }
  });
});

describe("buildSectionPatch", () => {
  it("keeps a cleared field blank exactly where lib/settings/merge says blank is a value", () => {
    for (const section of SETTINGS_SECTIONS) {
      const keys = Object.keys(SETTINGS_DEFAULTS[section]).filter((key) => {
        const sample = (SETTINGS_DEFAULTS[section] as Record<string, unknown>)[key];
        return typeof sample === "string" || Array.isArray(sample);
      });
      const blanks = Object.fromEntries(
        keys.map((key) => [key, Array.isArray((SETTINGS_DEFAULTS[section] as Record<string, unknown>)[key]) ? [] : ""])
      );
      const patch = buildSectionPatch(section, keys, blanks);
      const keptBlank = keys.filter((key) => patch[key] !== null).sort();
      expect({ section, keptBlank }).toEqual({
        section,
        keptBlank: [...(BLANK_IS_A_VALUE[section] ?? [])].filter((key) => keys.includes(key)).sort(),
      });
    }
  });


  it("sends only the given keys, clearing fallback fields with null", () => {
    expect(
      buildSectionPatch("company", ["name", "nameLocal", "phone"], {
        name: "",
        nameLocal: "",
        phone: "02-1234",
        email: "ignored@example.com",
      })
    ).toEqual({ name: null, nameLocal: "", phone: "02-1234" });
  });

  it("keeps empty lists where blank is a value", () => {
    expect(buildSectionPatch("mail", ["ccEmails", "senderEmail"], { ccEmails: [], senderEmail: "" }))
      .toEqual({ ccEmails: [], senderEmail: null });
  });

  it("passes numbers and booleans through", () => {
    expect(
      buildSectionPatch("quote", ["validityDays", "showAmountInWords"], {
        validityDays: 0,
        showAmountInWords: false,
      })
    ).toEqual({ validityDays: 0, showAmountInWords: false });
  });
});

describe("changedKeys", () => {
  it("compares values and arrays by content", () => {
    expect(
      changedKeys(
        { a: "x", b: ["1", "2"], c: true, d: "same" },
        { a: "y", b: ["1", "2"], c: false, d: "same" }
      )
    ).toEqual(["a", "c"]);
    expect(changedKeys({ list: ["a"] }, { list: ["a", "b"] })).toEqual(["list"]);
  });
});

describe("tabFromHash / formFieldOfErrorPath", () => {
  it("maps hashes to tabs", () => {
    expect(tabFromHash("#branding")).toBe("branding");
    expect(tabFromHash("ABOUT")).toBe("about");
    expect(tabFromHash("#nope")).toBeNull();
    expect(tabFromHash("")).toBeNull();
    expect(tabFromHash(undefined)).toBeNull();
  });

  it("maps nested server paths to their form field", () => {
    expect(formFieldOfErrorPath("ccEmails.1", ["ccEmails"])).toBe("ccEmails");
    expect(formFieldOfErrorPath("_form", ["ccEmails"])).toBeNull();
  });
});
