import { signedOutConfig } from "@/components/providers/signed-out-config";
import type { PublicAppConfig } from "@/lib/settings/types";

const config: PublicAppConfig = {
  appName: "Acme",
  companyName: "Acme Ltd",
  companyNameLocal: "艾克米",
  isDefaultCompany: false,
  currency: "TWD",
  currencyLocale: "zh-TW",
  fractionDigits: 0,
  defaultTaxRate: 5,
  validityDays: 30,
  defaultSalesperson: "Jane Probe",
  showAmountInWords: true,
  timezone: "Asia/Taipei",
  brandColor: "#1D4ED8",
  twVatLookup: true,
  mailEnabled: true,
  authEnabled: true,
  logoUrl: "/api/branding/logo?v=1",
  iconUrl: "/api/branding/icon?v=1",
  version: "1",
};

describe("signedOutConfig", () => {
  it("drops the salesperson's name and feature flags from the sign-in page's payload", () => {
    const out = signedOutConfig(config);
    expect(JSON.stringify(out)).not.toContain("Jane Probe");
    expect(out).toMatchObject({ defaultSalesperson: "", mailEnabled: false, twVatLookup: false });
  });

  it("keeps the branding the sign-in page shows, in the same shape", () => {
    const out = signedOutConfig(config);
    expect(Object.keys(out).sort()).toEqual(Object.keys(config).sort());
    for (const key of ["appName", "companyName", "companyNameLocal", "brandColor", "logoUrl", "iconUrl", "authEnabled"] as const) {
      expect(out[key]).toBe(config[key]);
    }
  });
});
