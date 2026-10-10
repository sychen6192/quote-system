import enValidation from "@/messages/en/Validation.json";
import {
  parseQuoteId,
  quoteFormSchema,
  quoteIdSchema,
  toFieldErrors,
  type QuoteFormValues,
} from "@/lib/schemas/quote";

function valid(overrides: Partial<QuoteFormValues> = {}): QuoteFormValues {
  return {
    companyName: "Acme Corp",
    contactPerson: "Jane Doe",
    email: "jane@acme.test",
    phone: "+886-2-1234-5678",
    address: "Taipei",
    vatNumber: "12345678",
    title: "",
    salesperson: "Alice",
    issuedDate: "2026-04-01",
    validUntil: "2026-05-01",
    shippingDate: "",
    paymentMethod: "",
    shippingMethod: "",
    taxRate: 5,
    discountType: "amount",
    discountValue: 0,
    otherFees: 0,
    notes: "",
    terms: "",
    items: [{ productName: "Widget", quantity: 2, unitPrice: 100, isTaxable: true }],
    ...overrides,
  };
}

function errorsOf(values: unknown) {
  const result = quoteFormSchema.safeParse(values);
  return result.success ? {} : toFieldErrors(result.error);
}

const VALIDATION_KEYS = new Set(Object.keys(enValidation));

describe("quoteFormSchema", () => {
  it("parses a valid quote with defaults", () => {
    const result = quoteFormSchema.safeParse({
      companyName: "  Acme  ",
      salesperson: "Alice",
      issuedDate: "2026-04-01",
      validUntil: "2026-04-01",
      taxRate: "5",
      items: [{ productName: "Widget", quantity: "1.5", unitPrice: "10.50" }],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.companyName).toBe("Acme");
    expect(result.data.taxRate).toBe(5);
    expect(result.data.discountType).toBe("amount");
    expect(result.data.discountValue).toBe(0);
    expect(result.data.otherFees).toBe(0);
    expect(result.data.items[0]).toEqual({
      productName: "Widget",
      quantity: 1.5,
      unitPrice: 10.5,
      isTaxable: true, // contract change: defaults to taxable (matches the DB)
    });
  });

  it.each<[string, Partial<QuoteFormValues>, string]>([
    ["companyName", { companyName: "" }, "required"],
    ["companyName", { companyName: "   " }, "required"],
    ["salesperson", { salesperson: "" }, "required"],
    ["email", { email: "not-an-email" }, "invalidEmail"],
    ["issuedDate", { issuedDate: "" }, "required"],
    ["issuedDate", { issuedDate: "2026-02-30" }, "invalidDate"],
    ["validUntil", { validUntil: "abc" }, "invalidDate"],
    ["validUntil", { issuedDate: "2026-05-01", validUntil: "2026-04-01" }, "validUntilBeforeIssued"],
    ["shippingDate", { shippingDate: "tomorrow" }, "invalidDate"],
    ["taxRate", { taxRate: 101 }, "taxRateRange"],
    ["taxRate", { taxRate: -1 }, "taxRateRange"],
    ["taxRate", { taxRate: 5.555 }, "tooManyDecimals"],
    ["taxRate", { taxRate: NaN }, "required"],
    ["taxRate", { taxRate: "abc" }, "invalidNumber"],
    ["items", { items: [] }, "itemsRequired"],
    ["discountValue", { discountType: "percent", discountValue: 100.5 }, "discountTooLarge"],
    ["discountValue", { discountValue: 201 }, "discountTooLarge"],
    ["discountValue", { discountValue: -1 }, "nonNegative"],
    ["discountValue", { discountValue: 1.234 }, "tooManyDecimals"],
    ["otherFees", { otherFees: -5 }, "nonNegative"],
    ["discountType", { discountType: "bogus" as "amount" }, "invalidValue"],
    ["title", { title: "x".repeat(201) }, "tooLong"],
  ])("%s: %j → %s", (field, overrides, message) => {
    expect(errorsOf(valid(overrides))[field]).toContain(message);
  });

  it.each([
    ["quantity", 0, "quantityPositive"],
    ["quantity", -1, "quantityPositive"],
    ["quantity", 1.2345, "tooManyDecimals"],
    ["quantity", 2e9, "tooLarge"],
    ["quantity", "", "required"],
    ["unitPrice", -0.01, "priceNonNegative"],
    ["unitPrice", 10.555, "tooManyDecimals"],
    ["unitPrice", 2e12, "tooLarge"],
    ["unitPrice", NaN, "required"],
    ["productName", "", "required"],
  ])("items.0.%s = %p → %s", (field, value, message) => {
    const items = [{ productName: "Widget", quantity: 1, unitPrice: 1, [field]: value }];
    expect(errorsOf(valid({ items } as Partial<QuoteFormValues>))[`items.0.${field}`]).toContain(
      message
    );
  });

  it("accepts the documented boundaries", () => {
    expect(
      quoteFormSchema.safeParse(
        valid({
          taxRate: 100,
          discountType: "percent",
          discountValue: 100,
          items: [{ productName: "x", quantity: 0.001, unitPrice: 0, isTaxable: false }],
        })
      ).success
    ).toBe(true);
    expect(quoteFormSchema.safeParse(valid({ taxRate: 0, email: "" })).success).toBe(true);
    expect(quoteFormSchema.safeParse(valid({ email: undefined })).success).toBe(true);
    // amount discount equal to the subtotal (2 × 100 = 200)
    expect(quoteFormSchema.safeParse(valid({ discountValue: 200 })).success).toBe(true);
  });

  it("measures the discount against the same line rounding as the totals", () => {
    // 0.145 × 1.00 = 0.145 → 15 cents (half up), so a 0.15 discount fits.
    const items = [{ productName: "x", quantity: 0.145, unitPrice: 1 }];
    expect(quoteFormSchema.safeParse(valid({ items, discountValue: 0.15 })).success).toBe(true);
    expect(errorsOf(valid({ items, discountValue: 0.16 })).discountValue).toContain(
      "discountTooLarge"
    );
  });

  // Float tolerance checks break down here: 626318921376.20 × 100 is off by
  // ~0.008 in binary, yet the user typed exactly two decimals.
  it.each([
    ["unitPrice", "626318921376.20"],
    ["unitPrice", "999999999999.99"],
    ["unitPrice", "572713421007.07"],
    ["quantity", "999999999.999"],
    ["quantity", "123456789.123"],
  ])("accepts large %s %s with the allowed decimals", (field, value) => {
    const items = [{ productName: "x", quantity: 1, unitPrice: 1, [field]: value }];
    const errors = errorsOf(valid({ items } as Partial<QuoteFormValues>));
    expect(errors[`items.0.${field}`]).toBeUndefined();
    const asNumber = [{ productName: "x", quantity: 1, unitPrice: 1, [field]: Number(value) }];
    expect(errorsOf(valid({ items: asNumber } as Partial<QuoteFormValues>))[`items.0.${field}`]).toBeUndefined();
  });

  it.each([
    ["unitPrice", "626318921376.201"],
    ["unitPrice", "0.001"],
    ["quantity", "1.0001"],
  ])("still rejects %s %s with too many decimals", (field, value) => {
    const items = [{ productName: "x", quantity: 1, unitPrice: 1, [field]: value }];
    expect(errorsOf(valid({ items } as Partial<QuoteFormValues>))[`items.0.${field}`]).toContain(
      "tooManyDecimals"
    );
  });

  it("rejects totals beyond Number.MAX_SAFE_INTEGER cents", () => {
    const items = [{ productName: "x", quantity: 1e9, unitPrice: 1e12 }];
    expect(errorsOf(valid({ items }))["items"]).toContain("totalTooLarge");
  });

  it("reports every problem at once, including cross-field ones", () => {
    const errors = errorsOf(
      valid({ companyName: "", taxRate: NaN, issuedDate: "2026-05-01", validUntil: "2026-04-01" })
    );
    expect(Object.keys(errors).sort()).toEqual(["companyName", "taxRate", "validUntil"]);
  });

  it("does not add a cross-field error on top of an invalid date", () => {
    const errors = errorsOf(valid({ validUntil: "" }));
    expect(errors.validUntil).toEqual(["required"]);
  });

  it("only ever emits keys of the Validation namespace", () => {
    const messages = new Set<string>();
    const samples: unknown[] = [
      {},
      null,
      "nope",
      valid({ items: [null, 5] as unknown as QuoteFormValues["items"] }),
      { items: "nope", email: 5, taxRate: {}, discountType: 1, isTaxable: "x" },
      valid({ companyName: "", items: [] }),
      valid({ items: [{ productName: "", quantity: "x", unitPrice: -1, isTaxable: "y" as unknown as boolean }] }),
      valid({ taxRate: 500, discountType: "percent", discountValue: 500, otherFees: -1 }),
      valid({ title: "x".repeat(300), shippingDate: "x", notes: 5 as unknown as string }),
    ];
    for (const sample of samples) {
      for (const list of Object.values(errorsOf(sample))) list.forEach((m) => messages.add(m));
    }
    expect(messages.size).toBeGreaterThan(5);
    for (const message of messages) expect(VALIDATION_KEYS).toContain(message);
  });
});

describe("quote ids", () => {
  it.each([
    [1, 1],
    ["42", 42],
    [" 7 ", 7],
    [2_147_483_647, 2_147_483_647],
    [2_147_483_648, null],
    ["99999999999", null],
    [0, null],
    [-1, null],
    [1.5, null],
    ["1.5", null],
    ["00001", null], // one canonical URL per quote
    ["0", null],
    ["abc", null],
    ["", null],
    [null, null],
    [undefined, null],
    [NaN, null],
  ])("parseQuoteId(%p) = %p", (value, expected) => {
    expect(parseQuoteId(value)).toBe(expected);
  });

  it("quoteIdSchema reports invalidId", () => {
    const result = quoteIdSchema.safeParse("1");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("invalidId");
  });
});
