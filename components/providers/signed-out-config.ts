import type { PublicAppConfig } from "@/lib/settings/types";

/**
 * What a signed-out visitor's page (the sign-in page) gets of the config:
 * the branding it shows, but not who works here or which features are
 * set up. Same shape, so client components work unchanged.
 */
export function signedOutConfig(config: PublicAppConfig): PublicAppConfig {
  return {
    ...config,
    defaultSalesperson: "",
    mailEnabled: false,
    twVatLookup: false,
  };
}
