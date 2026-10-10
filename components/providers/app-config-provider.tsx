"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PublicAppConfig } from "@/lib/settings/types";

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
