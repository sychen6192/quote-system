// Server half of the document labels: server pages and route handlers build
// QuoteDocumentLabels from the "QuoteDoc" namespace (the client twin is
// useQuoteDocumentLabels). Raw messages keep their {placeholders} for
// fillLabel.
import { getTranslations } from "next-intl/server";
import { buildQuoteDocumentLabels, type QuoteDocumentLabels } from "./label-keys";

export async function getQuoteDocumentLabels(locale: string): Promise<QuoteDocumentLabels> {
  const t = await getTranslations({ locale, namespace: "QuoteDoc" });
  return buildQuoteDocumentLabels((key) => t.raw(key));
}
