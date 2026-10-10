import {
  formValuesFromRecord,
  quoteRecordValues,
  quoteViewFromForm,
  quoteViewFromRecord,
  type QuoteRecord,
} from "@/lib/quote-view";
import { quoteFormSchema, type QuoteFormValues } from "@/lib/schemas/quote";

const today = "2026-10-09";

function formValues(overrides: Partial<QuoteFormValues> = {}): QuoteFormValues {
  return {
    companyName: "Acme Corp ",
    contactPerson: "Jane",
    email: "jane@acme.test",
    phone: "",
    address: "Taipei",
    vatNumber: "12345678",
    title: "Website",
    salesperson: "Alice",
    issuedDate: "2026-10-01",
    validUntil: "2026-10-31",
    shippingDate: "2026-11-15",
    paymentMethod: "月結30天",
    shippingMethod: "宅配",
    taxRate: 5,
    discountType: "percent",
    discountValue: 10,
    otherFees: 150.5,
    notes: "Thanks",
    terms: "",
    items: [
      { productName: "Design", description: "Logo", unit: "式", quantity: 1, unitPrice: 12000, isTaxable: true },
      { productName: "Hosting", description: "", unit: "月", quantity: 1.5, unitPrice: 333.33, isTaxable: false },
    ],
    ...overrides,
  };
}

function recordFrom(values: QuoteFormValues, extra: Partial<QuoteRecord> = {}): QuoteRecord {
  const parsed = quoteFormSchema.parse(values);
  const rec = quoteRecordValues(parsed);
  return {
    id: 7,
    quotationNumber: "QT-20261001-007",
    customerId: 3,
    status: "sent",
    createdAt: new Date("2026-10-01T02:00:00Z"),
    updatedAt: new Date("2026-10-01T02:00:00Z"),
    sentAt: null,
    decidedAt: null,
    ...rec.quote,
    shippingDate: rec.quote.shippingDate ?? null,
    title: rec.quote.title ?? null,
    paymentMethod: rec.quote.paymentMethod ?? null,
    shippingMethod: rec.quote.shippingMethod ?? null,
    notes: rec.quote.notes ?? null,
    terms: rec.quote.terms ?? null,
    subtotal: rec.quote.subtotal ?? 0,
    discountType: rec.quote.discountType ?? "amount",
    discountValue: rec.quote.discountValue ?? 0,
    discountAmount: rec.quote.discountAmount ?? 0,
    taxRate: rec.quote.taxRate ?? 0,
    taxAmount: rec.quote.taxAmount ?? 0,
    otherFees: rec.quote.otherFees ?? 0,
    totalAmount: rec.quote.totalAmount ?? 0,
    customer: {
      id: 3,
      createdAt: null,
      companyName: rec.customer.companyName,
      contactPerson: rec.customer.contactPerson ?? null,
      email: rec.customer.email ?? null,
      phone: rec.customer.phone ?? null,
      address: rec.customer.address ?? null,
      vatNumber: rec.customer.vatNumber ?? null,
    },
    // stored out of order on purpose: views sort by position, then id
    items: rec.items
      .map((item, i) => ({
        id: 100 + i,
        quotationId: 7,
        position: item.position ?? 0,
        productName: item.productName,
        description: item.description ?? null,
        unit: item.unit ?? null,
        quantity: item.quantity ?? 1,
        unitPrice: item.unitPrice,
        isTaxable: item.isTaxable ?? true,
      }))
      .reverse(),
    ...extra,
  };
}

describe("quoteRecordValues", () => {
  it("converts the parsed form to cents / basis points with computed totals", () => {
    const rec = quoteRecordValues(quoteFormSchema.parse(formValues()));
    expect(rec.customer).toEqual({
      companyName: "Acme Corp",
      contactPerson: "Jane",
      email: "jane@acme.test",
      phone: null,
      address: "Taipei",
      vatNumber: "12345678",
    });
    expect(rec.items).toEqual([
      { position: 0, productName: "Design", description: "Logo", unit: "式", quantity: 1, unitPrice: 1200000, isTaxable: true },
      { position: 1, productName: "Hosting", description: null, unit: "月", quantity: 1.5, unitPrice: 33333, isTaxable: false },
    ]);
    // subtotal = 1_200_000 + round(1.5 × 33_333 = 49_999.5) = 1_250_000
    // discount 10% = 125_000; taxable share = 125_000 × 1_200_000 / 1_250_000 = 120_000
    // tax = (1_200_000 − 120_000) × 5% = 54_000; fees 15_050
    expect(rec.quote).toMatchObject({
      title: "Website",
      terms: null,
      paymentMethod: "月結30天",
      shippingMethod: "宅配",
      shippingDate: "2026-11-15",
      subtotal: 1_250_000,
      discountType: "percent",
      discountValue: 1000,
      discountAmount: 125_000,
      taxRate: 500,
      taxAmount: 54_000,
      otherFees: 15_050,
      totalAmount: 1_250_000 - 125_000 + 54_000 + 15_050,
    });
  });

  it("stores an amount discount in cents", () => {
    const rec = quoteRecordValues(
      quoteFormSchema.parse(formValues({ discountType: "amount", discountValue: 99.99 }))
    );
    expect(rec.quote.discountValue).toBe(9999);
    expect(rec.quote.discountAmount).toBe(9999);
  });
});

describe("quoteViewFromRecord / quoteViewFromForm", () => {
  it("preview equals saved: both views compute identical totals", () => {
    for (const overrides of [
      {},
      { discountType: "amount" as const, discountValue: 1234.56 },
      { taxRate: 0, otherFees: 0, discountValue: 0 },
      { items: [{ productName: "x", quantity: 0.333, unitPrice: 0.01, isTaxable: true }] },
    ]) {
      const values = formValues(overrides);
      const fromForm = quoteViewFromForm(values, { today });
      const fromRecord = quoteViewFromRecord(recordFrom(values), { today });
      expect(fromForm.totals).toEqual(fromRecord.totals);
      expect(fromForm.items.map((i) => i.amount)).toEqual(fromRecord.items.map((i) => i.amount));
      expect(fromForm.discount).toEqual(fromRecord.discount);
      expect(fromForm.taxRate).toBe(fromRecord.taxRate);
    }
  });

  it("maps a record to the view model", () => {
    const view = quoteViewFromRecord(recordFrom(formValues()), { today });
    expect(view).toMatchObject({
      id: 7,
      quotationNumber: "QT-20261001-007",
      title: "Website",
      status: "sent",
      displayStatus: "sent",
      issuedDate: "2026-10-01",
      validUntil: "2026-10-31",
      salesperson: "Alice",
      customer: { companyName: "Acme Corp", phone: null },
      taxRate: 5,
      discount: { type: "percent", value: 10 },
      paymentTerms: "月結30天",
      deliveryMethod: "宅配",
      deliveryDate: "2026-11-15",
      notes: "Thanks",
      terms: null,
    });
    expect(view.items.map((i) => i.productName)).toEqual(["Design", "Hosting"]);
    expect(view.items[1]).toMatchObject({ unitPrice: 33333, amount: 50000, isTaxable: false });
  });

  it("derives expired only for open quotes", () => {
    const expired = recordFrom(formValues({ validUntil: "2026-10-08" }));
    expect(quoteViewFromRecord(expired, { today }).displayStatus).toBe("expired");
    expect(
      quoteViewFromRecord({ ...expired, status: "accepted" }, { today }).displayStatus
    ).toBe("accepted");
    expect(
      quoteViewFromForm(formValues({ validUntil: "2026-10-08" }), { today }).displayStatus
    ).toBe("expired");
  });

  it("handles legacy rows (null customer, null tax/fees/status)", () => {
    const legacy = recordFrom(formValues({ discountValue: 0, otherFees: 0 }), {
      customer: null,
      status: null,
      taxRate: null,
      otherFees: null,
      issuedDate: null,
    });
    const view = quoteViewFromRecord(legacy, { today });
    expect(view.status).toBe("draft");
    expect(view.customer.companyName).toBeNull();
    expect(view.taxRate).toBe(0);
    expect(view.totals.tax).toBe(0);
    expect(view.issuedDate).toBe("");
  });

  it("is lenient with half-typed form input", () => {
    const view = quoteViewFromForm(
      {
        companyName: "",
        taxRate: "",
        discountValue: "abc",
        items: [
          { productName: " Widget ", quantity: "2", unitPrice: "10.5" },
          { productName: "", quantity: NaN, unitPrice: "" },
        ],
      },
      { today, id: 3, quotationNumber: "QT-1", status: "sent" }
    );
    expect(view).toMatchObject({
      id: 3,
      quotationNumber: "QT-1",
      status: "sent",
      issuedDate: "",
      validUntil: "",
      displayStatus: "sent",
      taxRate: 0,
      discount: { type: "amount", value: 0 },
    });
    expect(view.items[0]).toMatchObject({ productName: "Widget", quantity: 2, unitPrice: 1050, amount: 2100, isTaxable: true });
    expect(view.items[1]).toMatchObject({ quantity: 0, unitPrice: 0, amount: 0 });
    expect(view.totals.total).toBe(2100);
  });
});

describe("formValuesFromRecord", () => {
  it("round-trips through the schema to the same record values", () => {
    const values = formValues();
    const record = recordFrom(values);
    const back = formValuesFromRecord(record);
    expect(back.items?.map((i) => i.productName)).toEqual(["Design", "Hosting"]);
    expect(back).toMatchObject({
      taxRate: 5,
      discountType: "percent",
      discountValue: 10,
      otherFees: 150.5,
      phone: "",
      terms: "",
    });
    expect(quoteRecordValues(quoteFormSchema.parse(back))).toEqual(
      quoteRecordValues(quoteFormSchema.parse(values))
    );
  });
});
