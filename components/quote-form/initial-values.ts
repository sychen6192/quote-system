// Initial form values for /quotes/new (blank, ?from= duplicate, ?customer=
// prefill). Pure and server-safe: the page computes them per request.
import { addDaysIso } from "@/lib/dates";
import type { QuoteFormValues } from "@/lib/schemas/quote";
import type { CustomerOption } from "@/services/customers";
import { emptyItem } from "./form-model";

export type QuoteDefaults = {
  /** YYYY-MM-DD in the business timezone */
  today: string;
  validityDays: number;
  /** percent */
  taxRate: number;
  salesperson: string;
  notes: string;
  terms: string;
};

function validUntil(today: string, validityDays: number): string {
  const days = Number.isFinite(validityDays) && validityDays > 0 ? Math.trunc(validityDays) : 30;
  return addDaysIso(today, days);
}

export function newQuoteValues(defaults: QuoteDefaults): QuoteFormValues {
  return {
    companyName: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    vatNumber: "",
    title: "",
    salesperson: defaults.salesperson,
    issuedDate: defaults.today,
    validUntil: validUntil(defaults.today, defaults.validityDays),
    paymentMethod: "",
    shippingMethod: "",
    shippingDate: "",
    taxRate: defaults.taxRate,
    discountType: "amount",
    discountValue: 0,
    otherFees: 0,
    items: [emptyItem()],
    notes: defaults.notes,
    terms: defaults.terms,
  };
}

/**
 * "Duplicate": everything but the dates. The delivery date belonged to the
 * old deal, so it is cleared rather than carried into the past.
 */
export function duplicateQuoteValues(
  source: QuoteFormValues,
  { today, validityDays }: Pick<QuoteDefaults, "today" | "validityDays">
): QuoteFormValues {
  return {
    ...source,
    items: (source.items ?? []).map((item) => ({ ...item })),
    issuedDate: today,
    validUntil: validUntil(today, validityDays),
    shippingDate: "",
  };
}

/**
 * ?customer=<name>: the bill-to block from the company's newest quote, and
 * that quote's payment terms and delivery method where it had them.
 */
export function withCustomer(values: QuoteFormValues, customer: CustomerOption): QuoteFormValues {
  return {
    ...values,
    companyName: customer.companyName,
    contactPerson: customer.contactPerson ?? "",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    vatNumber: customer.vatNumber ?? "",
    address: customer.address ?? "",
    paymentMethod: customer.paymentMethod || values.paymentMethod,
    shippingMethod: customer.shippingMethod || values.shippingMethod,
  };
}
