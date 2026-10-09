// PLACEHOLDER — replaced in Wave B (B3). Client-safe (no server-only imports):
// rendered by the quote detail page (server) and the live preview (client).
import type { QuoteView } from "@/lib/quote-view";
import type { DocumentBranding } from "@/lib/settings/types";

/** Every user-visible string of the document, pre-translated by the caller. */
export type QuoteDocumentLabels = Record<string, string>;

export type QuoteDocumentProps = {
  view: QuoteView;
  /** getDocumentBranding("html") on the server; the client gets it via props */
  branding: DocumentBranding;
  labels: QuoteDocumentLabels;
  /** UI locale, used for date formatting */
  locale: string;
  /** Live preview: adds data-edit-field targets + hover affordances */
  interactive?: boolean;
  /** Called with a form field path (e.g. "items.2.productName") when an editable region is clicked */
  onEditField?: (field: string) => void;
};

export function QuoteDocument({ view }: QuoteDocumentProps) {
  return <div data-placeholder>{view.quotationNumber}</div>;
}
