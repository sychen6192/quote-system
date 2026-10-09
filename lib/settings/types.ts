// Contract for runtime settings (spec §6). Implemented by services/settings.ts.
// Client components must only ever see PublicAppConfig.

export type BrandingKind = "logo" | "stamp" | "icon";

export type EffectiveSettings = {
  company: {
    name: string;
    nameLocal: string;
    address: string;
    vatNumber: string;
    email: string;
    phone: string;
    website: string;
    /** true when no company name was configured anywhere (placeholder branding) */
    isDefault: boolean;
  };
  /** null when every payment field is empty (section hidden) */
  payment: {
    bankName: string;
    bankCode: string;
    accountName: string;
    accountNumber: string;
  } | null;
  quote: {
    numberPattern: string;
    validityDays: number;
    defaultTaxRate: number;
    defaultNotes: string;
    defaultTerms: string;
    defaultSalesperson: string;
    showAmountInWords: boolean;
    footerText: string;
  };
  money: {
    currency: string;
    currencyLocale: string;
    fractionDigits: number;
  };
  appearance: { brandColor: string };
  region: { timezone: string };
  mail: {
    enabled: boolean;
    /** Resend API key from env only. NEVER send to the client. */
    apiKey: string;
    senderName: string;
    senderEmail: string;
    ccEmails: string[];
    replyTo: string;
  };
  features: { twVatLookup: boolean };
  auth: { enabled: boolean };
  /** Changes whenever settings or branding assets change (cache busting). */
  version: string;
};

export type PublicAppConfig = {
  companyName: string;
  companyNameLocal: string;
  isDefaultCompany: boolean;
  currency: string;
  currencyLocale: string;
  fractionDigits: number;
  defaultTaxRate: number;
  validityDays: number;
  defaultSalesperson: string;
  showAmountInWords: boolean;
  timezone: string;
  brandColor: string;
  twVatLookup: boolean;
  mailEnabled: boolean;
  authEnabled: boolean;
  /** e.g. /api/branding/logo?v=<version> */
  logoUrl: string;
  iconUrl: string;
  version: string;
};

/** Branding data a quote document (HTML or PDF) needs. */
export type DocumentBranding = {
  company: EffectiveSettings["company"];
  payment: EffectiveSettings["payment"];
  /** html mode: URL; pdf mode: data URI. Always set (falls back to default logo). */
  logoSrc: string;
  /** null when no stamp is configured */
  stampSrc: string | null;
  brandColor: string;
  currency: string;
  currencyLocale: string;
  fractionDigits: number;
  showAmountInWords: boolean;
  footerText: string;
  timezone: string;
};

export type BrandingAsset = { data: Buffer; mime: string; version: string };
