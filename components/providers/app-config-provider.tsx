"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import type { PublicAppConfig } from "@/lib/settings/types";
import { formatMoney } from "@/lib/money";

const AppConfigContext = createContext<PublicAppConfig | null>(null);

export function AppConfigProvider({
  value,
  children,
}: {
  value: PublicAppConfig;
  children: ReactNode;
}) {
  return (
    <AppConfigContext.Provider value={value}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig(): PublicAppConfig {
  const config = useContext(AppConfigContext);
  if (!config) {
    throw new Error("useAppConfig must be used within <AppConfigProvider>");
  }
  return config;
}

/** cents → "NT$1,234" in the configured currency (never the UI locale). */
export function useFormatCurrency(): (cents: number) => string {
  const { currency, currencyLocale, fractionDigits } = useAppConfig();
  return useCallback(
    (cents: number) => formatMoney(cents, { currency, currencyLocale, fractionDigits }),
    [currency, currencyLocale, fractionDigits]
  );
}
