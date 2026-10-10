import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { calculateQuoteFinancials, lineAmount, toBasisPoints, toCents } from "@/lib/money";

// Shared by the form (zodResolver) and the server actions. Every message is
// a KEY of the "Validation" i18n namespace; render with
// t(`Validation.${message}`).
//
// Money inputs are MAJOR units here (10.5 = NT$10.50); the actions convert
// them to cents / basis points with lib/money.

export const MAX_DB_ID = 2_147_483_647;
export const MAX_ITEMS = 200;
// quotation_items.quantity is numeric(12,3): |value| < 10^(12-3).
export const MAX_QUANTITY = 999_999_999.999;
export const MAX_UNIT_PRICE = 1e12;
const MAX_TOTAL_CENTS = Number.MAX_SAFE_INTEGER;

export const DISCOUNT_TYPE_VALUES = ["amount", "percent"] as const;

// Compares against the shortest decimal rendering instead of scaling: past
// ~5e11, value × 100 is off by more than any fixed tolerance in binary, so
// a price typed with two decimals would be rejected. The tolerance branch
// keeps accepting tiny float noise such as 0.1 + 0.2.
function hasAtMostDecimals(value: number, decimals: number): boolean {
  if (Number(value.toFixed(decimals)) === value) return true;
  const scaled = value * 10 ** decimals;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

// Accepts what forms produce: numbers (valueAsNumber gives NaN when empty)
// or strings from text inputs with inputMode="decimal".
const numberInput = z
  .custom<number | string | null | undefined>(
    (v) => v == null || typeof v === "number" || typeof v === "string",
    { error: "invalidNumber" }
  )
  .transform((v): number | undefined => {
    if (v == null) return undefined;
    if (typeof v === "number") return Number.isNaN(v) ? undefined : v;
    const text = v.trim();
    return text === "" ? undefined : Number(text);
  });

const requiredNumber = () =>
  numberInput.pipe(
    z.number({
      error: (issue) => (issue.input === undefined ? "required" : "invalidNumber"),
    })
  );

const optionalNumber = () =>
  numberInput.pipe(z.number({ error: "invalidNumber" }).default(0));

// Postgres text cannot hold NUL: reject it here as a field error instead of
// failing the insert with a generic error.
const noNul = (s: string) => !s.includes("\u0000");

const requiredText = (max: number) =>
  z
    .string({ error: "required" })
    .trim()
    .min(1, "required")
    .max(max, "tooLong")
    .refine(noNul, "invalidText");

const optionalText = (max: number) =>
  z.string({ error: "invalidText" }).trim().max(max, "tooLong").refine(noNul, "invalidText").optional();

const isoDate = () =>
  z
    .string({ error: "required" })
    .trim()
    .min(1, "required")
    .pipe(z.iso.date({ error: "invalidDate" }));

export const quoteItemSchema = z.object({
  productName: requiredText(200),
  description: optionalText(2000),
  unit: optionalText(20),
  quantity: requiredNumber()
    .refine((v) => v > 0, "quantityPositive")
    .refine((v) => v <= MAX_QUANTITY, "tooLarge")
    .refine((v) => hasAtMostDecimals(v, 3), "tooManyDecimals"),
  unitPrice: requiredNumber()
    .refine((v) => v >= 0, "priceNonNegative")
    .refine((v) => v <= MAX_UNIT_PRICE, "tooLarge")
    .refine((v) => hasAtMostDecimals(v, 2), "tooManyDecimals"),
  isTaxable: z.boolean({ error: "invalidValue" }).default(true),
}, { error: "invalidValue" });

const quoteBaseSchema = z.object({
  // Customer (bill-to snapshot)
  companyName: requiredText(200),
  contactPerson: optionalText(100),
  email: z
    .string({ error: "invalidEmail" })
    .trim()
    .pipe(
      z.union([
        z.literal(""),
        z.email({ error: "invalidEmail" }).max(254, "tooLong"),
      ])
    )
    .optional(),
  phone: optionalText(50),
  address: optionalText(500),
  vatNumber: optionalText(20),

  // Quote info
  title: optionalText(200),
  salesperson: requiredText(100),
  issuedDate: isoDate(),
  validUntil: isoDate(),
  paymentMethod: optionalText(200),
  shippingMethod: optionalText(200),
  shippingDate: z
    .union([z.literal(""), z.iso.date({ error: "invalidDate" })], {
      error: "invalidDate",
    })
    .optional(),

  // Totals
  taxRate: requiredNumber()
    .refine((v) => v >= 0 && v <= 100, "taxRateRange")
    .refine((v) => hasAtMostDecimals(v, 2), "tooManyDecimals"),
  discountType: z
    .enum(DISCOUNT_TYPE_VALUES, { error: "invalidValue" })
    .default("amount"),
  discountValue: optionalNumber()
    .refine((v) => v >= 0, "nonNegative")
    .refine((v) => v <= MAX_UNIT_PRICE, "tooLarge")
    .refine((v) => hasAtMostDecimals(v, 2), "tooManyDecimals"),
  otherFees: optionalNumber()
    .refine((v) => v >= 0, "nonNegative")
    .refine((v) => v <= MAX_UNIT_PRICE, "tooLarge")
    .refine((v) => hasAtMostDecimals(v, 2), "tooManyDecimals"),

  items: z
    .array(quoteItemSchema, { error: "itemsRequired" })
    .min(1, "itemsRequired")
    .max(MAX_ITEMS, "tooManyItems"),

  // Terms
  notes: optionalText(5000),
  terms: optionalText(5000),
}, { error: "invalidValue" });

type PartialQuote = Partial<Record<keyof z.output<typeof quoteBaseSchema>, unknown>>;

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Cents subtotal of already-parsed items, or null if any item is unusable. */
function parsedSubtotal(items: unknown): number | null {
  if (!Array.isArray(items)) return null;
  let subtotal = 0;
  for (const item of items as { quantity?: unknown; unitPrice?: unknown }[]) {
    if (!finite(item?.quantity) || !finite(item?.unitPrice)) return null;
    subtotal += lineAmount(item.quantity, toCents(item.unitPrice));
  }
  return subtotal;
}

// Run the cross-field checks even when another field is already invalid, so
// the form shows every problem at once; each check guards its own inputs.
// Only skip them when the input is not an object at all.
const always = {
  when: (payload: { value: unknown }) =>
    typeof payload.value === "object" && payload.value !== null,
} as const;

export const quoteFormSchema = quoteBaseSchema
  .refine(
    (data) => {
      const { issuedDate, validUntil } = data as PartialQuote;
      return !(isIsoDate(issuedDate) && isIsoDate(validUntil)) || validUntil >= issuedDate;
    },
    { message: "validUntilBeforeIssued", path: ["validUntil"], ...always }
  )
  .refine(
    (data) => {
      const { discountType, discountValue, items } = data as PartialQuote;
      if (!finite(discountValue) || discountValue <= 0) return true;
      if (discountType === "percent") return discountValue <= 100;
      const subtotal = parsedSubtotal(items);
      return subtotal === null || toCents(discountValue) <= subtotal;
    },
    { message: "discountTooLarge", path: ["discountValue"], ...always }
  )
  .refine(
    (data) => {
      const { items, taxRate, discountType, discountValue, otherFees } =
        data as PartialQuote;
      if (parsedSubtotal(items) === null) return true;
      const totals = calculateQuoteFinancials(
        (items as { quantity: number; unitPrice: number; isTaxable?: boolean }[]).map(
          (item) => ({ ...item, unitPrice: toCents(item.unitPrice) })
        ),
        {
          taxRateBp: finite(taxRate) ? toBasisPoints(taxRate) : 0,
          discount: {
            type: discountType === "percent" ? "percent" : "amount",
            value: finite(discountValue)
              ? discountType === "percent"
                ? toBasisPoints(discountValue)
                : toCents(discountValue)
              : 0,
          },
          otherFees: finite(otherFees) ? toCents(otherFees) : 0,
        }
      );
      return (
        Math.abs(totals.subtotal) <= MAX_TOTAL_CENTS &&
        Math.abs(totals.total) <= MAX_TOTAL_CENTS
      );
    },
    { message: "totalTooLarge", path: ["items"], ...always }
  );

/** What the form holds (inputs may still be strings / NaN). */
export type QuoteFormValues = z.input<typeof quoteFormSchema>;
/** What a successful parse returns (numbers, defaults applied). */
export type QuoteFormData = z.output<typeof quoteFormSchema>;
export type QuoteItemFormValues = z.input<typeof quoteItemSchema>;
export type QuoteItemFormData = z.output<typeof quoteItemSchema>;

/** Database ids: positive int4. */
export const quoteIdSchema = z
  .number({ error: "invalidId" })
  .int("invalidId")
  .positive("invalidId")
  .max(MAX_DB_ID, "invalidId");

/** Accepts a number or an all-digits string (route params); null otherwise. */
export function parseQuoteId(value: unknown): number | null {
  const n =
    typeof value === "string" && /^[1-9]\d{0,9}$/.test(value.trim())
      ? Number(value.trim())
      : value;
  const parsed = quoteIdSchema.safeParse(n);
  return parsed.success ? parsed.data : null;
}

/**
 * Zod issues → { "items.0.quantity": ["quantityPositive"], ... } so the form
 * can map server errors back with setError(path).
 */
export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
