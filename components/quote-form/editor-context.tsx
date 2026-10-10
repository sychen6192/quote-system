"use client";

import { createContext, useContext, useEffect, useEffectEvent, useMemo } from "react";
import { useAppConfig } from "@/components/providers/app-config-provider";
import { currencyFractionDigits, formatMoney, minorUnitStep, type MoneyFormat } from "@/lib/money";

type Listener = (path: string) => void;

/** Tiny pub/sub: "reveal and focus this field" requests from the preview. */
export function createRevealBus() {
  const listeners = new Set<Listener>();
  return {
    emit(path: string) {
      listeners.forEach((listener) => listener(path));
    },
    on(listener: Listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type RevealBus = ReturnType<typeof createRevealBus>;

/** Tiny pub/sub without a payload, e.g. "the form is about to be saved". */
export function createSignal() {
  const listeners = new Set<() => void>();
  return {
    emit() {
      listeners.forEach((listener) => listener());
    },
    on(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type Signal = ReturnType<typeof createSignal>;

export type EditorContextValue = {
  /** YYYY-MM-DD in the business timezone (from the server) */
  today: string;
  reveal: RevealBus;
  /** Session expired / server unreachable: toast and reload to the login page. */
  onSessionExpired: () => void;
  /**
   * Emitted when Save is pressed, before validation: drop trailing blank item
   * rows, cancel suggestion searches that would only race the save.
   */
  submitting: Signal;
};

const EditorContext = createContext<EditorContextValue | null>(null);

export const EditorProvider = EditorContext.Provider;

export function useEditor(): EditorContextValue {
  const value = useContext(EditorContext);
  if (!value) throw new Error("useEditor must be used inside the quote form");
  return value;
}

/** Runs `onSubmit` every time Save is pressed, before the form is validated. */
export function useSubmittingListener(onSubmit: () => void): void {
  const { submitting } = useEditor();
  const handler = useEffectEvent(onSubmit);
  useEffect(() => submitting.on(() => handler()), [submitting]);
}

/** Runs `onReveal` for every reveal request (e.g. open a collapsed description). */
export function useRevealListener(onReveal: (path: string) => void): void {
  const { reveal } = useEditor();
  const handler = useEffectEvent(onReveal);
  useEffect(() => reveal.on((path) => handler(path)), [reveal]);
}

function currencySymbol(currency: string, currencyLocale: string): string {
  try {
    return (
      new Intl.NumberFormat(currencyLocale, { style: "currency", currency })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value ?? currency
    );
  } catch {
    return currency;
  }
}

/** Money formatting from the configured currency (never the UI locale). */
export function useMoney() {
  const { currency, currencyLocale, fractionDigits } = useAppConfig();
  return useMemo(() => {
    const format: MoneyFormat = { currency, currencyLocale, fractionDigits };
    const digits =
      typeof fractionDigits === "number" ? fractionDigits : currencyFractionDigits(currency);
    return {
      currency,
      digits,
      /** Cents per displayed unit: line amounts and totals are rounded to it (lib/money). */
      step: minorUnitStep(digits),
      symbol: currencySymbol(currency, currencyLocale),
      format: (cents: number) => formatMoney(cents, format),
    };
  }, [currency, currencyLocale, fractionDigits]);
}
