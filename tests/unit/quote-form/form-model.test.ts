import {
  collectErrorPaths,
  emptyItem,
  formTotals,
  isFormPath,
  lenientNumber,
  mapServerFieldErrors,
  normalizeDecimalInput,
  roundToDisplayed,
  previewFieldToFormPath,
  quoteDraftKey,
  quoteDraftPrefix,
  sectionForPath,
  sectionStates,
  toNumberOrNaN,
} from "@/components/quote-form/form-model";
import { quoteRecordValues } from "@/lib/quote-view";
import { quoteFormSchema, type QuoteFormValues } from "@/lib/schemas/quote";

const base: QuoteFormValues = {
  companyName: "宏達電子股份有限公司",
  contactPerson: "王小明",
  email: "",
  phone: "",
  address: "",
  vatNumber: "",
  title: "",
  salesperson: "陳業務",
  issuedDate: "2026-10-09",
  validUntil: "2026-11-08",
  paymentMethod: "",
  shippingMethod: "",
  shippingDate: "",
  taxRate: 5,
  discountType: "amount",
  discountValue: 0,
  otherFees: 0,
  items: [{ productName: "伺服器維護", quantity: 1, unitPrice: 12000, isTaxable: true }],
  notes: "",
  terms: "",
};

describe("normalizeDecimalInput", () => {
  it.each([
    ["１２３", "123"],
    ["１２．５", "12.5"],
    ["1,234,567.50", "1234567.50"],
    ["1，234", "1234"],
    ["1,5", "1.5"],
    [" 42 ", "42"],
    ["－3", "-3"],
    ["abc", "abc"],
    ["", ""],
  ])("%p → %p", (input, expected) => {
    expect(normalizeDecimalInput(input)).toBe(expected);
  });
});

describe("toNumberOrNaN / lenientNumber", () => {
  it("parses numbers and IME input", () => {
    expect(toNumberOrNaN(2.5)).toBe(2.5);
    expect(toNumberOrNaN("２.５")).toBe(2.5);
    expect(toNumberOrNaN("1,200")).toBe(1200);
  });
  it("is NaN for empty or junk, which lenientNumber turns into 0", () => {
    expect(toNumberOrNaN("")).toBeNaN();
    expect(toNumberOrNaN(undefined)).toBeNaN();
    expect(toNumberOrNaN("abc")).toBeNaN();
    expect(lenientNumber("abc")).toBe(0);
    expect(lenientNumber(null)).toBe(0);
  });
});

describe("formTotals", () => {
  it("matches what the server stores for the same input", () => {
    const values: QuoteFormValues = {
      ...base,
      taxRate: "5",
      discountType: "percent",
      discountValue: "10",
      otherFees: "350",
      items: [
        { productName: "A", quantity: "2.5", unitPrice: "1200.50", isTaxable: true },
        { productName: "B", quantity: "3", unitPrice: "999", isTaxable: false },
        { productName: "C", quantity: "0.145", unitPrice: "100", isTaxable: true },
      ],
    };
    const parsed = quoteFormSchema.parse(values);
    expect(formTotals(values)).toEqual(quoteRecordValues(parsed).totals);
  });

  it("treats half-typed values leniently", () => {
    const totals = formTotals({
      items: [
        { productName: "", quantity: "", unitPrice: "100" },
        { productName: "", quantity: "2", unitPrice: "abc" },
      ],
      taxRate: "",
    });
    expect(totals).toMatchObject({ subtotal: 0, tax: 0, total: 0 });
  });

  it("applies an amount discount in cents and clamps it to the subtotal", () => {
    const totals = formTotals({
      items: [{ productName: "A", quantity: 1, unitPrice: 1000 }],
      taxRate: 5,
      discountType: "amount",
      discountValue: 5000,
    });
    expect(totals.discount).toBe(100_000);
    expect(totals.total).toBe(0);
  });
});

describe("sections", () => {
  it("maps field paths to their section", () => {
    expect(sectionForPath("companyName")).toBe("customer");
    expect(sectionForPath("items.3.quantity")).toBe("items");
    expect(sectionForPath("items")).toBe("items");
    expect(sectionForPath("discountValue")).toBe("totals");
    expect(sectionForPath("shippingDate")).toBe("terms");
    expect(sectionForPath("_form")).toBeNull();
  });

  it("computes complete / incomplete / optional / error", () => {
    expect(sectionStates(base, [])).toEqual({
      customer: "complete",
      details: "complete",
      items: "complete",
      totals: "complete",
      terms: "optional",
    });
    const states = sectionStates(
      {
        ...base,
        companyName: " ",
        items: [{ productName: "A", quantity: "0", unitPrice: "1" }],
        notes: "Thanks",
      },
      ["validUntil"]
    );
    expect(states).toEqual({
      customer: "incomplete",
      details: "error",
      items: "incomplete",
      totals: "complete",
      terms: "complete",
    });
  });

  it("an empty item list is incomplete", () => {
    expect(sectionStates({ ...base, items: [] }, []).items).toBe("incomplete");
  });
});

describe("collectErrorPaths", () => {
  it("flattens nested RHF errors and skips refs", () => {
    const ref = { focus() {}, nested: { message: "not an error" } };
    const items: unknown[] = [];
    items[1] = { quantity: { type: "custom", message: "quantityPositive", ref } };
    Object.assign(items, { root: { type: "custom", message: "totalTooLarge" } });
    const paths = collectErrorPaths({
      companyName: { type: "custom", message: "required", ref },
      items,
    });
    expect(paths.sort()).toEqual(["companyName", "items", "items.1.quantity"]);
  });

  it("handles empty input", () => {
    expect(collectErrorPaths(undefined)).toEqual([]);
    expect(collectErrorPaths({})).toEqual([]);
  });
});

describe("previewFieldToFormPath", () => {
  it.each([
    ["customer.companyName", "companyName"],
    ["customer.vatNumber", "vatNumber"],
    ["companyName", "companyName"],
    ["items.2.productName", "items.2.productName"],
    ["items.2.amount", "items.2.unitPrice"],
    ["items.4", "items.4.productName"],
    ["items.1.whatever", "items.1.productName"],
    ["paymentTerms", "paymentMethod"],
    ["deliveryMethod", "shippingMethod"],
    ["deliveryDate", "shippingDate"],
    ["totals.discount", "discountValue"],
    ["totals.tax", "taxRate"],
    ["notes", "notes"],
    ["quotationNumber", null],
    ["", null],
  ])("%p → %p", (input, expected) => {
    expect(previewFieldToFormPath(input)).toBe(expected);
  });
});

describe("mapServerFieldErrors", () => {
  it("splits field errors from form-level ones", () => {
    expect(
      mapServerFieldErrors({
        companyName: ["required"],
        "items.0.quantity": ["quantityPositive", "tooLarge"],
        items: ["totalTooLarge"],
        id: ["invalidId"],
        _form: ["invalidValue"],
        email: [],
        "items.0.bogus": ["required"],
      })
    ).toEqual({
      fields: [
        { path: "companyName", message: "required" },
        { path: "items.0.quantity", message: "quantityPositive" },
        { path: "items.root", message: "totalTooLarge" },
      ],
      form: ["invalidId", "invalidValue", "required"],
    });
  });

  it("knows the form paths", () => {
    expect(isFormPath("items.10.isTaxable")).toBe(true);
    expect(isFormPath("items.x.quantity")).toBe(false);
    expect(isFormPath("terms")).toBe(true);
    expect(isFormPath("customer")).toBe(false);
  });
});

describe("draft keys", () => {
  it("separates new drafts from each saved version of a quote", () => {
    expect(quoteDraftKey()).toBe("qs:draft:new");
    expect(quoteDraftKey({ id: 7, updatedAt: new Date(1_700_000_000_000) })).toBe(
      "qs:draft:edit:7:1700000000000"
    );
    expect(quoteDraftKey({ id: 7, updatedAt: null })).toBe("qs:draft:edit:7:0");
    expect(quoteDraftKey({ id: 7, updatedAt: "2026-10-09T00:00:00Z" })).toBe(
      `qs:draft:edit:7:${Date.parse("2026-10-09T00:00:00Z")}`
    );
    expect(quoteDraftKey({ id: 7, updatedAt: 5 }).startsWith(quoteDraftPrefix(7))).toBe(true);
  });
});

describe("emptyItem", () => {
  it("is a fresh object each time", () => {
    const a = emptyItem();
    const b = emptyItem();
    expect(a).not.toBe(b);
    expect(a).toEqual({
      productName: "",
      description: "",
      unit: "",
      quantity: 1,
      unitPrice: "",
      isTaxable: true,
    });
  });
});

describe("roundToDisplayed", () => {
  it("rounds cents to the currency's displayed precision", () => {
    expect(roundToDisplayed(45016250, 0)).toBe(45016300);
    expect(roundToDisplayed(45016249, 0)).toBe(45016200);
    expect(roundToDisplayed(-150, 0)).toBe(-200);
    expect(roundToDisplayed(12345, 2)).toBe(12345);
    expect(roundToDisplayed(12345, 1)).toBe(12350);
    expect(roundToDisplayed(12345, 3)).toBe(12345);
  });
});
