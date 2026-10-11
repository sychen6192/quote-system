// The Settings page loader: provenance from services/settings (no direct
// app_settings query of its own), and nothing loaded for a signed-out request.
const getSettings = jest.fn();
const getBrandingStatus = jest.fn();
const getSettingsProvenance = jest.fn();
const assertAuthenticated = jest.fn();

jest.mock("@/services/settings", () => ({
  getSettings: (...args: unknown[]) => getSettings(...args),
  getBrandingStatus: (...args: unknown[]) => getBrandingStatus(...args),
  getSettingsProvenance: (...args: unknown[]) => getSettingsProvenance(...args),
}));
jest.mock("@/lib/auth/guard", () => ({
  assertAuthenticated: (...args: unknown[]) => assertAuthenticated(...args),
}));
// Fails the suite if the loader still queries the database itself.
jest.mock("@/db", () => {
  throw new Error("load-settings must not import the database");
});

import { loadSettingsPageData } from "@/app/[locale]/settings/load-settings";
import { mergeSettings, SETTINGS_DEFAULTS } from "@/lib/settings/merge";
import { getEnvSettings } from "@/lib/config";
import { parseSettingsLayer } from "@/lib/settings/schema";

const ENV = { COMPANY_NAME: "Env Co.", COMPANY_ADDRESS: "Env street 1", CURRENCY: "TWD" };
const STORED = { company: { name: "Saved Co.", address: "" }, quote: { validityDays: 14 } };

beforeEach(() => {
  jest.clearAllMocks();
  const env = getEnvSettings(ENV);
  getSettings.mockResolvedValue(mergeSettings(SETTINGS_DEFAULTS, env, STORED));
  getBrandingStatus.mockResolvedValue({ logo: "default", icon: "default", stamp: "none" });
  getSettingsProvenance.mockResolvedValue({
    env: env.layer,
    stored: parseSettingsLayer(STORED),
    storeUnavailable: false,
    sources: {},
  });
  assertAuthenticated.mockResolvedValue(undefined);
});

describe("loadSettingsPageData", () => {
  it("resolves values and provenance from getSettingsProvenance()", async () => {
    const data = await loadSettingsPageData();
    expect(getSettingsProvenance).toHaveBeenCalledTimes(1);
    expect(data.values.company.name).toBe("Saved Co.");
    expect(data.meta.company.name).toMatchObject({ source: "db", fallback: "Env Co." });
    // A saved blank address hides it (blank is a value), it does not fall back to env.
    expect(data.values.company.address).toBe("");
    expect(data.meta.company.address.source).toBe("db");
    expect(data.values.quote.validityDays).toBe(14);
    // TWD: amount in words on by default.
    expect(data.values.quote.showAmountInWords).toBe(true);
    expect(data.storeUnavailable).toBe(false);
  });

  it("says when the settings store could not be read", async () => {
    getSettingsProvenance.mockResolvedValueOnce({
      env: getEnvSettings(ENV).layer,
      stored: {},
      storeUnavailable: true,
      sources: {},
    });
    const data = await loadSettingsPageData();
    expect(data.storeUnavailable).toBe(true);
    expect(data.meta.company.name.source).toBe("env");
  });

  it("loads nothing for a signed-out request", async () => {
    assertAuthenticated.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    await expect(loadSettingsPageData()).rejects.toThrow("UNAUTHENTICATED");
    expect(getSettings).not.toHaveBeenCalled();
    expect(getSettingsProvenance).not.toHaveBeenCalled();
    expect(getBrandingStatus).not.toHaveBeenCalled();
  });
});
