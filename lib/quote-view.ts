// Shared view model (spec §7). The HTML document, the live preview and the
// PDF all render a QuoteView, and both constructors go through
// calculateQuoteFinancials, so the preview always equals what gets saved.
// Client-safe: only type imports from the DB schema.
import type { customers, quotationItems, quotations } from "@/db/schema";
import { toIsoDate } from "@/lib/dates";
import {
  calculateQuoteFinancials,
  lineAmount,
  toBasisPoints,
  toCents,
  toPercentage,
  type DiscountType,
  type QuoteFinancials,
} from "@/lib/money";
import type { QuoteFormData, QuoteFormValues } from "@/lib/schemas/quote";
import { displayStatus, normalizeStatus, type DisplayStatus, type QuoteStatus } from "@/lib/status";

export type QuoteViewCustomer = {
  companyName: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  vatNumber: string | null;
};

export type QuoteViewItem = {
  productName: string;
  description: string | null;
  unit: string | null;
  quantity: number;
  /** cents */
  unitPrice: number;
  isTaxable: boolean;
  /** cents */
  amount: number;
};

export type QuoteView = {
  id: number | null;
  quotationNumber: string | null;
  title: string | null;
  status: QuoteStatus;
  displayStatus: DisplayStatus;
  /** YYYY-MM-DD ("" while a form date is still empty) */
  issuedDate: string;
  validUntil: string;
  salesperson: string;
  customer: QuoteViewCustomer;
  items: QuoteViewItem[];
  /** percent, e.g. 5 */
  taxRate: number;
  /** value: major units for "amount", percent for "percent" */
  discount: { type: DiscountType; value: number };
  /** cents */
  totals: QuoteFinancials;
  /** 付款條件 (stored as payment_method) */
  paymentTerms: string | null;
  /** 交貨方式 (stored as shipping_method) */
  deliveryMethod: string | null;
  /** 交貨日期 (stored as shipping_date), YYYY-MM-DD */
  deliveryDate: string | null;
  notes: string | null;
  terms: string | null;
};

type QuoteRow = typeof quotations.$inferSelect;
type CustomerRow = typeof customers.$inferSelect;
type ItemRow = typeof quotationItems.$inferSelect;

export type QuoteRecord = QuoteRow & {
  customer: CustomerRow | null;
  items: ItemRow[];
};

function text(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed === "" ? null : trimmed;
}

function lenientNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function sortItems(items: ItemRow[]): ItemRow[] {
  return [...items].sort((a, b) => a.position - b.position || a.id - b.id);
}

export function quoteViewFromRecord(
  row: QuoteRecord,
  { today }: { today: string }
): QuoteView {
  const items: QuoteViewItem[] = sortItems(row.items).map((item) => ({
    productName: item.productName,
    description: text(item.description),
    unit: text(item.unit),
    quantity: Number(item.quantity),
    unitPrice: item.unitPrice,
    isTaxable: item.isTaxable ?? true,
    amount: lineAmount(Number(item.quantity), item.unitPrice),
  }));
  const discountType: DiscountType =
    row.discountType === "percent" ? "percent" : "amount";
  const taxRateBp = row.taxRate ?? 0;
  const totals = calculateQuoteFinancials(items, {
    taxRateBp,
    discount: { type: discountType, value: row.discountValue },
    otherFees: row.otherFees ?? 0,
  });
  const status = normalizeStatus(row.status);
  const validUntil = toIsoDate(row.validUntil) ?? "";

  return {
    id: row.id,
    quotationNumber: row.quotationNumber,
    title: text(row.title),
    status,
    displayStatus: displayStatus(status, validUntil, today),
    issuedDate: toIsoDate(row.issuedDate) ?? "",
    validUntil,
    salesperson: row.salesperson ?? "",
    customer: {
      companyName: text(row.customer?.companyName),
      contactPerson: text(row.customer?.contactPerson),
      email: text(row.customer?.email),
      phone: text(row.customer?.phone),
      address: text(row.customer?.address),
      vatNumber: text(row.customer?.vatNumber),
    },
    items,
    taxRate: toPercentage(taxRateBp),
    discount: {
      type: discountType,
      // amount: cents → major; percent: basis points → percent
      value: row.discountValue / 100,
    },
    totals,
    paymentTerms: text(row.paymentMethod),
    deliveryMethod: text(row.shippingMethod),
    deliveryDate: toIsoDate(row.shippingDate),
    notes: text(row.notes),
    terms: text(row.terms),
  };
}

/** Deliberately lenient: renders whatever the form holds while typing. */
export function quoteViewFromForm(
  values: Partial<QuoteFormValues>,
  {
    today,
    id = null,
    quotationNumber = null,
    status = "draft",
  }: {
    today: string;
    id?: number | null;
    quotationNumber?: string | null;
    status?: QuoteStatus;
  }
): QuoteView {
  const items: QuoteViewItem[] = (values.items ?? []).map((item) => {
    const quantity = lenientNumber(item?.quantity);
    const unitPrice = toCents(lenientNumber(item?.unitPrice));
    return {
      productName: (item?.productName ?? "").trim(),
      description: text(item?.description),
      unit: text(item?.unit),
      quantity,
      unitPrice,
      isTaxable: item?.isTaxable ?? true,
      amount: lineAmount(quantity, unitPrice),
    };
  });
  const discountType: DiscountType =
    values.discountType === "percent" ? "percent" : "amount";
  const discountValue = lenientNumber(values.discountValue);
  const taxRate = lenientNumber(values.taxRate);
  const totals = calculateQuoteFinancials(items, {
    taxRateBp: toBasisPoints(taxRate),
    discount: {
      type: discountType,
      value:
        discountType === "percent"
          ? toBasisPoints(discountValue)
          : toCents(discountValue),
    },
    otherFees: toCents(lenientNumber(values.otherFees)),
  });
  const validUntil = toIsoDate(values.validUntil ?? null) ?? "";

  return {
    id,
    quotationNumber,
    title: text(values.title),
    status,
    displayStatus: displayStatus(status, validUntil, today),
    issuedDate: toIsoDate(values.issuedDate ?? null) ?? "",
    validUntil,
    salesperson: (values.salesperson ?? "").trim(),
    customer: {
      companyName: text(values.companyName),
      contactPerson: text(values.contactPerson),
      email: text(values.email),
      phone: text(values.phone),
      address: text(values.address),
      vatNumber: text(values.vatNumber),
    },
    items,
    taxRate,
    discount: { type: discountType, value: discountValue },
    totals,
    paymentTerms: text(values.paymentMethod),
    deliveryMethod: text(values.shippingMethod),
    deliveryDate: toIsoDate(values.shippingDate ?? null),
    notes: text(values.notes),
    terms: text(values.terms),
  };
}

/** A saved quote as form values (edit page, "duplicate" via ?from=). */
export function formValuesFromRecord(row: QuoteRecord): QuoteFormValues {
  return {
    companyName: row.customer?.companyName ?? "",
    contactPerson: row.customer?.contactPerson ?? "",
    email: row.customer?.email ?? "",
    phone: row.customer?.phone ?? "",
    address: row.customer?.address ?? "",
    vatNumber: row.customer?.vatNumber ?? "",
    title: row.title ?? "",
    salesperson: row.salesperson ?? "",
    issuedDate: toIsoDate(row.issuedDate) ?? "",
    validUntil: toIsoDate(row.validUntil) ?? "",
    paymentMethod: row.paymentMethod ?? "",
    shippingMethod: row.shippingMethod ?? "",
    shippingDate: toIsoDate(row.shippingDate) ?? "",
    taxRate: toPercentage(row.taxRate ?? 0),
    discountType: row.discountType === "percent" ? "percent" : "amount",
    discountValue: row.discountValue / 100,
    otherFees: (row.otherFees ?? 0) / 100,
    items: sortItems(row.items).map((item) => ({
      productName: item.productName,
      description: item.description ?? "",
      unit: item.unit ?? "",
      quantity: Number(item.quantity),
      unitPrice: item.unitPrice / 100,
      isTaxable: item.isTaxable ?? true,
    })),
    notes: row.notes ?? "",
    terms: row.terms ?? "",
  };
}

function nullable(value: string | null | undefined): string | null {
  return value === undefined || value === null || value === "" ? null : value;
}

export type QuoteRecordValues = {
  customer: Omit<typeof customers.$inferInsert, "id" | "createdAt">;
  quote: Omit<
    typeof quotations.$inferInsert,
    "id" | "quotationNumber" | "customerId" | "status" | "createdAt" | "updatedAt" | "sentAt" | "decidedAt"
  > & { issuedDate: string; validUntil: string };
  items: Omit<typeof quotationItems.$inferInsert, "id" | "quotationId">[];
  totals: QuoteFinancials;
};

/**
 * Parsed form data → DB column values (cents, basis points, positions,
 * computed totals). The inverse of formValuesFromRecord.
 */
export function quoteRecordValues(data: QuoteFormData): QuoteRecordValues {
  const items = data.items.map((item, position) => ({
    position,
    productName: item.productName,
    description: nullable(item.description),
    unit: nullable(item.unit),
    quantity: item.quantity,
    unitPrice: toCents(item.unitPrice),
    isTaxable: item.isTaxable,
  }));
  const taxRateBp = toBasisPoints(data.taxRate);
  const discountValue =
    data.discountType === "percent"
      ? toBasisPoints(data.discountValue)
      : toCents(data.discountValue);
  const otherFees = toCents(data.otherFees);
  const totals = calculateQuoteFinancials(items, {
    taxRateBp,
    discount: { type: data.discountType, value: discountValue },
    otherFees,
  });

  return {
    customer: {
      companyName: data.companyName,
      contactPerson: nullable(data.contactPerson),
      email: nullable(data.email),
      phone: nullable(data.phone),
      address: nullable(data.address),
      vatNumber: nullable(data.vatNumber),
    },
    quote: {
      title: nullable(data.title),
      salesperson: data.salesperson,
      issuedDate: data.issuedDate,
      validUntil: data.validUntil,
      shippingDate: nullable(data.shippingDate),
      paymentMethod: nullable(data.paymentMethod),
      shippingMethod: nullable(data.shippingMethod),
      notes: nullable(data.notes),
      terms: nullable(data.terms),
      subtotal: totals.subtotal,
      discountType: data.discountType,
      discountValue,
      discountAmount: totals.discount,
      taxRate: taxRateBp,
      taxAmount: totals.tax,
      otherFees: totals.otherFees,
      totalAmount: totals.total,
    },
    items,
    totals,
  };
}
