"use client";

import { createContext, useContext } from "react";
import type { SettingsPageData, SettingsTab } from "./model";

/** What each section form exposes to the page for the unsaved-changes guard. */
export type SectionHandle = {
  isDirty: () => boolean;
  /** Validates and saves; false when it did not save (invalid input, error). */
  save: () => Promise<boolean>;
  discard: () => void;
};

export type SettingsContextValue = {
  data: SettingsPageData;
  register: (tab: SettingsTab, handle: SectionHandle) => () => void;
  setDirty: (tab: SettingsTab, dirty: boolean) => void;
  /** Switches section, asking first when the current one has unsaved changes. */
  goTo: (tab: SettingsTab) => void;
  /** The session expired: reload to the sign-in page without the unsaved-changes prompt. */
  sessionExpired: () => void;
};

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettingsPage(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettingsPage must be used within <SettingsView>");
  return value;
}
