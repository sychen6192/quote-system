// PLACEHOLDER — replaced in Wave B (B3). Builds QuoteDocumentLabels from the
// "QuoteDoc" messages namespace so server pages, the client preview and the
// PDF all share one set of translations.
import type { QuoteDocumentLabels } from "./quote-document";

/** Server: e.g. in a page or route handler. */
export async function getQuoteDocumentLabels(
  _locale: string
): Promise<QuoteDocumentLabels> {
  return {};
}
