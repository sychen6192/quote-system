// Pure, client-safe helpers behind the quote editor: section bookkeeping,
// lenient number parsing, live totals and error-path mapping. No React, so
// they are unit-tested directly and also importable from server pages.
import { isIsoDate } from "@/lib/dates";
import {
  calculateQuoteFinancials,
  toBasisPoints,
  toCents,
  type QuoteFinancials,
} from "@/lib/money";
import type { QuoteFormValues, QuoteItemFormValues } from "@/lib/schemas/quote";

export const SECTION_IDS = ["customer", "details", "items", "totals", "terms"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

/**
 * complete: everything required is filled · error: a field has an error ·
 * incomplete: something required is missing · optional: nothing required
 * and nothing filled yet.
 */
export type SectionState = "complete" | "error" | "incomplete" | "optional";

export const FORM_FIELDS = [
  "companyName",
  "contactPerson",
  "email",
  "phone",
  "vatNumber",
  "address",
  "title",
  "salesperson",
  "issuedDate",
  "validUntil",
  "items",
  "taxRate",
  "discountType",
  "discountValue",
  "otherFees",
  "paymentMethod",
  "shippingMethod",
  "shippingDate",
  "notes",
  "terms",
] as const satisfies readonly (keyof QuoteFormValues)[];
export type FormFieldName = (typeof FORM_FIELDS)[number];

export const ITEM_FIELDS = [
  "productName",
  "description",
  "unit",
  "quantity",
  "unitPrice",
  "isTaxable",
] as const satisfies readonly (keyof QuoteItemFormValues)[];

const SECTION_FIELDS: Record<SectionId, readonly FormFieldName[]> = {
  customer: ["companyName", "contactPerson", "email", "phone", "vatNumber", "address"],
  details: ["title", "salesperson", "issuedDate", "validUntil"],
  items: ["items"],
  totals: ["taxRate", "discountType", "discountValue", "otherFees"],
  terms: ["paymentMethod", "shippingMethod", "shippingDate", "notes", "terms"],
};

export function sectionDomId(id: SectionId): string {
  return `section-${id}`;
}

/** "items.2.quantity" → "items"; null for paths outside the form. */
export function sectionForPath(path: string): SectionId | null {
  const head = path.split(".")[0];
  for (const id of SECTION_IDS) {
    if ((SECTION_FIELDS[id] as readonly string[]).includes(head)) return id;
  }
  return null;
}

/** The fields the section index watches (a narrow useWatch, not the whole form). */
export const SECTION_WATCH_FIELDS = [
  "companyName",
  "salesperson",
  "issuedDate",
  "validUntil",
  "items",
  "taxRate",
  "paymentMethod",
  "shippingMethod",
  "shippingDate",
  "notes",
  "terms",
] as const satisfies readonly FormFieldName[];

export type SectionInputs = Partial<
  Pick<QuoteFormValues, (typeof SECTION_WATCH_FIELDS)[number]>
>;

function filled(value: unknown): boolean {
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return Number.isFinite(value);
  return value !== undefined && value !== null;
}

function itemComplete(item: Partial<QuoteItemFormValues> | undefined): boolean {
  if (!item) return false;
  const quantity = toNumberOrNaN(item.quantity);
  const price = toNumberOrNaN(item.unitPrice);
  return filled(item.productName) && quantity > 0 && price >= 0;
}

export function sectionStates(
  values: SectionInputs,
  errorPaths: readonly string[]
): Record<SectionId, SectionState> {
  const withErrors = new Set(
    errorPaths.map(sectionForPath).filter((id): id is SectionId => id !== null)
  );
  const items = Array.isArray(values.items) ? values.items : [];
  const complete: Record<Exclude<SectionId, "terms">, boolean> = {
    customer: filled(values.companyName),
    details:
      filled(values.salesperson) &&
      isIsoDate(values.issuedDate) &&
      isIsoDate(values.validUntil),
    items: items.length > 0 && items.every(itemComplete),
    totals: Number.isFinite(toNumberOrNaN(values.taxRate)),
  };
  const termsStarted = (
    ["paymentMethod", "shippingMethod", "shippingDate", "notes", "terms"] as const
  ).some((field) => filled(values[field]));

  const state = (id: SectionId): SectionState => {
    if (withErrors.has(id)) return "error";
    if (id === "terms") return termsStarted ? "complete" : "optional";
    return complete[id] ? "complete" : "incomplete";
  };
  return Object.fromEntries(SECTION_IDS.map((id) => [id, state(id)])) as Record<
    SectionId,
    SectionState
  >;
}

/**
 * RHF's nested errors object → dotted paths ("items.1.quantity"). An array's
 * own error (`items.root`) is reported as the array path. `ref` holds DOM
 * nodes and is never walked.
 */
export function collectErrorPaths(errors: unknown): string[] {
  const out = new Set<string>();
  const walk = (node: unknown, path: string, depth: number) => {
    if (!node || typeof node !== "object" || depth > 6) return;
    const record = node as Record<string, unknown>;
    if (path && (typeof record.message === "string" || typeof record.type === "string")) {
      out.add(path);
    }
    for (const [key, child] of Object.entries(record)) {
      if (key === "ref" || key === "message" || key === "type" || key === "types") continue;
      if (key === "root") walk(child, path, depth + 1);
      else walk(child, path ? `${path}.${key}` : key, depth + 1);
    }
  };
  walk(errors, "", 0);
  return [...out];
}

const FULL_WIDTH_DIGIT = /[０-９]/g;
const GROUPED = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/;

/**
 * What people actually type into a number field → a plain decimal string:
 * full-width digits and punctuation from a CJK IME, grouping commas, and a
 * lone decimal comma. Anything else is returned trimmed, for the schema to
 * reject.
 */
export function normalizeDecimalInput(value: string): string {
  let text = value
    .replace(FULL_WIDTH_DIGIT, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, ".")
    .replace(/，/g, ",")
    .replace(/[－−]/g, "-")
    .replace(/[\s　]/g, "");
  if (GROUPED.test(text)) text = text.replace(/,/g, "");
  else if (/^-?\d+,\d+$/.test(text)) text = text.replace(",", ".");
  return text;
}

/** NaN when empty or not a number. */
export function toNumberOrNaN(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return NaN;
  const text = normalizeDecimalInput(value);
  return text === "" ? NaN : Number(text);
}

/** Live-preview leniency: anything unusable counts as 0. */
export function lenientNumber(value: unknown): number {
  const n = toNumberOrNaN(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * The same conversions as quoteRecordValues on the server (cents, basis
 * points), applied to whatever the form holds while typing.
 */
export function formTotals(
  values: Partial<
    Pick<QuoteFormValues, "items" | "taxRate" | "discountType" | "discountValue" | "otherFees">
  >
): QuoteFinancials {
  const items = (values.items ?? []).map((item) => ({
    quantity: lenientNumber(item?.quantity),
    unitPrice: toCents(lenientNumber(item?.unitPrice)),
    isTaxable: item?.isTaxable ?? true,
  }));
  const percent = values.discountType === "percent";
  const discountValue = lenientNumber(values.discountValue);
  return calculateQuoteFinancials(items, {
    taxRateBp: toBasisPoints(lenientNumber(values.taxRate)),
    discount: {
      type: percent ? "percent" : "amount",
      value: percent ? toBasisPoints(discountValue) : toCents(discountValue),
    },
    otherFees: toCents(lenientNumber(values.otherFees)),
  });
}

/**
 * Cents rounded the way formatMoney displays them (half away from zero), e.g.
 * 45016250 → 45016300 for TWD (0 fraction digits).
 */
export function roundToDisplayed(cents: number, fractionDigits: number): number {
  const digits = Math.min(Math.max(Math.trunc(fractionDigits) || 0, 0), 2);
  const step = 10 ** (2 - digits);
  const rounded = Math.round(Math.abs(cents) / step) * step;
  return cents < 0 ? -rounded : rounded;
}

export function emptyItem(): QuoteItemFormValues {
  return {
    productName: "",
    description: "",
    unit: "",
    quantity: 1,
    unitPrice: "",
    isTaxable: true,
  };
}

export const VALIDITY_PRESET_DAYS = [7, 14, 30, 60] as const;

const ITEM_PATH = /^items\.(\d+)\.([A-Za-z]+)$/;

/** A form path the editor can focus, or null. */
export function isFormPath(path: string): boolean {
  const item = ITEM_PATH.exec(path);
  if (item) return (ITEM_FIELDS as readonly string[]).includes(item[2]);
  return (FORM_FIELDS as readonly string[]).includes(path);
}

const PREVIEW_ALIASES: Record<string, string> = {
  "customer.companyName": "companyName",
  "customer.contactPerson": "contactPerson",
  "customer.email": "email",
  "customer.phone": "phone",
  "customer.address": "address",
  "customer.vatNumber": "vatNumber",
  paymentTerms: "paymentMethod",
  deliveryMethod: "shippingMethod",
  deliveryDate: "shippingDate",
  discount: "discountValue",
  "discount.value": "discountValue",
  "discount.type": "discountValue",
  "totals.discount": "discountValue",
  "totals.tax": "taxRate",
  "totals.taxBase": "taxRate",
  "totals.otherFees": "otherFees",
  "totals.subtotal": "items.0.unitPrice",
  customer: "companyName",
};

/**
 * Click-to-edit: the document reports a field path (form paths, or QuoteView
 * paths such as "customer.email" / "items.2.amount"); map it to the input
 * that produces it.
 */
export function previewFieldToFormPath(field: string): string | null {
  const path = field.trim();
  if (!path) return null;
  const alias = PREVIEW_ALIASES[path];
  if (alias) return alias;
  const item = ITEM_PATH.exec(path);
  if (item) {
    const [, index, key] = item;
    if (key === "amount") return `items.${index}.unitPrice`;
    return (ITEM_FIELDS as readonly string[]).includes(key) ? path : `items.${index}.productName`;
  }
  if (/^items\.\d+$/.test(path)) return `${path}.productName`;
  return isFormPath(path) ? path : null;
}

/**
 * Server VALIDATION fieldErrors (dotted paths → message keys) → setError
 * calls. Array-level errors go to "items.root"; paths the form has no input
 * for (e.g. "id", "_form") come back as form-level messages.
 */
export function mapServerFieldErrors(
  fieldErrors: Record<string, readonly string[] | undefined>
): { fields: { path: string; message: string }[]; form: string[] } {
  const fields: { path: string; message: string }[] = [];
  const form: string[] = [];
  for (const [path, messages] of Object.entries(fieldErrors)) {
    const message = messages?.find((m) => typeof m === "string" && m !== "");
    if (!message) continue;
    if (path === "items") fields.push({ path: "items.root", message });
    else if (isFormPath(path)) fields.push({ path, message });
    else form.push(message);
  }
  return { fields, form };
}

/** localStorage key of the autosaved draft (spec §10). */
export function quoteDraftKey(
  edit?: { id: number; updatedAt: Date | string | number | null | undefined } | null
): string {
  if (!edit) return "qs:draft:new";
  const stamp =
    edit.updatedAt instanceof Date
      ? edit.updatedAt.getTime()
      : typeof edit.updatedAt === "number"
        ? edit.updatedAt
        : typeof edit.updatedAt === "string"
          ? Date.parse(edit.updatedAt) || 0
          : 0;
  return `${quoteDraftPrefix(edit.id)}${stamp}`;
}

/** Every draft of one saved quote, whatever its updatedAt. */
export function quoteDraftPrefix(id: number): string {
  return `qs:draft:edit:${id}:`;
}
