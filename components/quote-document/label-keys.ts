// The quote document's strings (messages/<locale>/QuoteDoc.json). Pure and
// client-safe: the HTML document, the live preview and the PDF all take the
// same pre-translated labels object, so they cannot drift apart.

export const QUOTE_DOC_LABEL_KEYS = [
  "title",
  "titleAlt",
  "documentLabel",
  "number",
  "numberPending",
  "subject",
  "billTo",
  "attn",
  "address",
  "phone",
  "email",
  "vatNumber",
  "website",
  "issuedDate",
  "validUntil",
  "salesperson",
  "paymentTerms",
  "deliveryMethod",
  "deliveryDate",
  "currency",
  "colIndex",
  "colItem",
  "colQty",
  "colUnitPrice",
  "colAmount",
  "taxExempt",
  "emptyItems",
  "itemPlaceholder",
  "customerPlaceholder",
  "subtotal",
  "discount",
  "discountPercent",
  "tax",
  "otherFees",
  "total",
  "amountInWords",
  "notes",
  "terms",
  "paymentDetails",
  "bankName",
  "bankCode",
  "accountName",
  "accountNumber",
  "customerSignature",
  "companySignature",
  "signatureDate",
  "page",
  "editField",
] as const;

export type QuoteDocLabelKey = (typeof QUOTE_DOC_LABEL_KEYS)[number];

/**
 * Every user-visible string of the document, pre-translated by the caller.
 * Templates keep their `{placeholders}` (see fillLabel): discountPercent
 * {percent}, tax {rate}, page {current} {total}, documentLabel {number}.
 */
export type QuoteDocumentLabels = Readonly<Record<QuoteDocLabelKey, string>>;

/** Builds the labels from a raw-message reader (next-intl's t.raw, or a JSON object). */
export function buildQuoteDocumentLabels(raw: (key: QuoteDocLabelKey) => unknown): QuoteDocumentLabels {
  const labels = {} as Record<QuoteDocLabelKey, string>;
  for (const key of QUOTE_DOC_LABEL_KEYS) {
    const value = raw(key);
    labels[key] = typeof value === "string" ? value : "";
  }
  return labels;
}

/**
 * Replaces `{name}` placeholders of a raw message. Only simple arguments are
 * supported: the document's templates have no plurals or selects.
 */
export function fillLabel(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match
  );
}
