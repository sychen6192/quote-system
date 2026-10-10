"use client";
// Client twin of getQuoteDocumentLabels (the live preview).
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { buildQuoteDocumentLabels, type QuoteDocumentLabels } from "./label-keys";

export function useQuoteDocumentLabels(): QuoteDocumentLabels {
  const t = useTranslations("QuoteDoc");
  return useMemo(() => buildQuoteDocumentLabels((key) => t.raw(key)), [t]);
}
