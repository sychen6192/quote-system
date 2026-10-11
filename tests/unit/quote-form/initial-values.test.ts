import {
  duplicateQuoteValues,
  newQuoteValues,
  withCustomer,
} from "@/components/quote-form/initial-values";
import { quoteFormSchema } from "@/lib/schemas/quote";

const defaults = {
  today: "2026-10-09",
  validityDays: 30,
  taxRate: 5,
  salesperson: "陳業務",
  notes: "感謝您的詢價。",
  terms: "本報價單有效期限內簽回即生效。",
};

describe("newQuoteValues", () => {
  it("starts from the settings defaults with one blank item", () => {
    const values = newQuoteValues(defaults);
    expect(values).toMatchObject({
      issuedDate: "2026-10-09",
      validUntil: "2026-11-08",
      taxRate: 5,
      salesperson: "陳業務",
      notes: "感謝您的詢價。",
      terms: "本報價單有效期限內簽回即生效。",
      discountType: "amount",
      discountValue: 0,
      otherFees: 0,
    });
    expect(values.items).toHaveLength(1);
  });

  it("falls back to 30 days for a nonsensical validity", () => {
    expect(newQuoteValues({ ...defaults, validityDays: 0 }).validUntil).toBe("2026-11-08");
    expect(newQuoteValues({ ...defaults, validityDays: 7 }).validUntil).toBe("2026-10-16");
  });

  it("is only invalid where the user must still type", () => {
    const result = quoteFormSchema.safeParse(newQuoteValues(defaults));
    expect(result.success).toBe(false);
    const paths = result.success ? [] : result.error.issues.map((i) => i.path.join("."));
    expect(paths.sort()).toEqual(["companyName", "items.0.productName", "items.0.unitPrice"]);
  });
});

describe("duplicateQuoteValues", () => {
  it("keeps customer, items and terms but resets the dates", () => {
    const source = {
      ...newQuoteValues(defaults),
      companyName: "日昇貿易有限公司",
      issuedDate: "2026-01-02",
      validUntil: "2026-01-31",
      shippingDate: "2026-01-20",
      paymentMethod: "月結30天",
      items: [{ productName: "A", quantity: 2.5, unitPrice: 100, isTaxable: false }],
    };
    const copy = duplicateQuoteValues(source, { today: "2026-10-09", validityDays: 14 });
    expect(copy).toMatchObject({
      companyName: "日昇貿易有限公司",
      issuedDate: "2026-10-09",
      validUntil: "2026-10-23",
      shippingDate: "",
      paymentMethod: "月結30天",
    });
    expect(copy.items).toEqual(source.items);
    expect(copy.items[0]).not.toBe(source.items[0]);
  });
});

describe("withCustomer", () => {
  it("fills the bill-to block and blanks missing fields", () => {
    const values = withCustomer(newQuoteValues(defaults), {
      companyName: "Acme Inc.",
      contactPerson: null,
      email: "buyer@acme.test",
      phone: null,
      vatNumber: null,
      address: "1 Main St",
      paymentMethod: null,
      shippingMethod: null,
    });
    expect(values).toMatchObject({
      companyName: "Acme Inc.",
      contactPerson: "",
      email: "buyer@acme.test",
      phone: "",
      vatNumber: "",
      address: "1 Main St",
      paymentMethod: "",
      shippingMethod: "",
    });
  });

  it("carries the payment terms and delivery method of their last quote", () => {
    const values = withCustomer(newQuoteValues(defaults), {
      companyName: "Acme Inc.",
      contactPerson: null,
      email: null,
      phone: null,
      vatNumber: null,
      address: null,
      paymentMethod: "月結30天",
      shippingMethod: "宅配",
    });
    expect(values).toMatchObject({ paymentMethod: "月結30天", shippingMethod: "宅配" });
  });
});
