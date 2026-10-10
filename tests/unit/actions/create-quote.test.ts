jest.mock("@/db", () => ({ db: { transaction: jest.fn() } }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/auth/guard", () => ({
  assertAuthenticated: jest.fn(),
  isUnauthenticatedError: (e: unknown) => e instanceof Error && e.message === "UNAUTHENTICATED",
}));
jest.mock("@/services/settings", () => ({ getSettings: jest.fn() }));
jest.mock("@/lib/quote-number", () => ({
  ...jest.requireActual("@/lib/quote-number"),
  allocateQuoteNumber: jest.fn(),
}));

import { revalidatePath } from "next/cache";
import { createQuote } from "@/actions/create-quote";
import { db } from "@/db";
import { assertAuthenticated } from "@/lib/auth/guard";
import { allocateQuoteNumber } from "@/lib/quote-number";
import { getSettings } from "@/services/settings";
import { createTxMock, testSettings } from "./helpers";

const mockTransaction = db.transaction as jest.Mock;
const mockAuth = assertAuthenticated as jest.Mock;
const mockAllocate = allocateQuoteNumber as jest.Mock;
const mockSettings = getSettings as jest.Mock;

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    companyName: " Acme Corp ",
    contactPerson: "Jane Doe",
    email: "jane@acme.test",
    phone: "",
    address: "Taipei",
    vatNumber: "12345678",
    title: "Website rebuild",
    salesperson: "Alice",
    issuedDate: "2026-04-01",
    validUntil: "2026-05-01",
    shippingDate: "",
    paymentMethod: "月結30天",
    shippingMethod: "",
    taxRate: 5,
    discountType: "amount",
    discountValue: 20,
    otherFees: 10,
    notes: "",
    terms: "Net 30",
    items: [
      { productName: "Widget", description: "Blue", unit: "個", quantity: 2, unitPrice: 100, isTaxable: true },
      { productName: "Shipping box", quantity: 1, unitPrice: 50 },
    ],
    ...overrides,
  };
}

function uniqueViolation(constraint = "quotations_quotation_number_unique") {
  return Object.assign(new Error("duplicate key value violates unique constraint"), {
    code: "23505",
    constraint_name: constraint,
  });
}

let txMock: ReturnType<typeof createTxMock>;

beforeEach(() => {
  mockAuth.mockResolvedValue(undefined);
  mockSettings.mockResolvedValue(testSettings());
  mockAllocate.mockResolvedValue("QT-20260401-001");
  txMock = createTxMock({ insert: [[{ id: 11 }], [{ id: 5 }], [], []] });
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(txMock.tx));
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe("createQuote", () => {
  describe("auth", () => {
    it("returns UNAUTHORIZED without touching the DB", async () => {
      mockAuth.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
      const res = await createQuote(validInput());
      expect(res).toMatchObject({ success: false, code: "UNAUTHORIZED" });
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it("rethrows unexpected guard errors", async () => {
      mockAuth.mockRejectedValueOnce(new Error("cookies() outside a request"));
      await expect(createQuote(validInput())).rejects.toThrow("cookies()");
    });
  });

  describe("VALIDATION", () => {
    it.each([
      ["companyName", { companyName: "" }, "required"],
      ["salesperson", { salesperson: "" }, "required"],
      ["email", { email: "not-an-email" }, "invalidEmail"],
      ["taxRate", { taxRate: 101 }, "taxRateRange"],
      ["validUntil", { issuedDate: "2026-05-01", validUntil: "2026-04-01" }, "validUntilBeforeIssued"],
      ["items", { items: [] }, "itemsRequired"],
      ["items.0.quantity", { items: [{ productName: "x", quantity: 0, unitPrice: 1 }] }, "quantityPositive"],
    ])("rejects bad %s with a Validation key", async (field, overrides, key) => {
      const res = await createQuote(validInput(overrides));
      expect(res).toMatchObject({ success: false, code: "VALIDATION" });
      if (!res.success && res.code === "VALIDATION") {
        expect(res.fieldErrors[field]).toContain(key);
      }
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it.each([null, undefined, "nope", 42, []])("rejects non-object input %p", async (data) => {
      const res = await createQuote(data);
      expect(res).toMatchObject({ success: false, code: "VALIDATION" });
      if (!res.success && res.code === "VALIDATION") {
        expect(Object.values(res.fieldErrors).flat()).toContain("invalidValue");
      }
    });

    it("accepts a 25% tax rate (the old 20% cap is gone)", async () => {
      await expect(createQuote(validInput({ taxRate: 25 }))).resolves.toMatchObject({ success: true });
    });

    it("accepts an empty email", async () => {
      await expect(createQuote(validInput({ email: "" }))).resolves.toEqual({ success: true, id: 5 });
    });
  });

  describe("success", () => {
    it("writes snapshot, number, totals, items with position and a created event", async () => {
      const res = await createQuote(validInput());
      expect(res).toEqual({ success: true, id: 5 });

      expect(mockAllocate).toHaveBeenCalledWith(txMock.tx, {
        pattern: "QT-{YYYY}{MM}{DD}-{SEQ:3}",
        issuedDate: "2026-04-01",
      });

      const [customer, quote, items, event] = txMock.argsOf("insert", "values");
      expect(customer).toEqual({
        companyName: "Acme Corp",
        contactPerson: "Jane Doe",
        email: "jane@acme.test",
        phone: null,
        address: "Taipei",
        vatNumber: "12345678",
      });
      // subtotal 25_000; discount 2_000 (taxable share 2_000 × 25_000/25_000)
      // tax = 23_000 × 5% = 1_150 → NT$11.5 rounds to whole NT$12 (TWD
      // settings); fees 1_000
      expect(quote).toMatchObject({
        quotationNumber: "QT-20260401-001",
        customerId: 11,
        status: "draft",
        title: "Website rebuild",
        salesperson: "Alice",
        issuedDate: "2026-04-01",
        validUntil: "2026-05-01",
        shippingDate: null,
        paymentMethod: "月結30天",
        shippingMethod: null,
        notes: null,
        terms: "Net 30",
        subtotal: 25_000,
        discountType: "amount",
        discountValue: 2_000,
        discountAmount: 2_000,
        taxRate: 500,
        taxAmount: 1_200,
        otherFees: 1_000,
        totalAmount: 25_000 - 2_000 + 1_200 + 1_000,
      });
      expect(items).toEqual([
        { position: 0, productName: "Widget", description: "Blue", unit: "個", quantity: 2, unitPrice: 10_000, isTaxable: true, quotationId: 5 },
        { position: 1, productName: "Shipping box", description: null, unit: null, quantity: 1, unitPrice: 5_000, isTaxable: true, quotationId: 5 },
      ]);
      expect(event).toEqual({ quoteId: 5, type: "created", data: { quotationNumber: "QT-20260401-001" } });
      expect(revalidatePath).toHaveBeenCalledWith("/[locale]", "layout");
    });

    it("falls back to the default pattern when the configured one is invalid", async () => {
      mockSettings.mockResolvedValue(
        testSettings({ quote: { ...testSettings().quote, numberPattern: "QT-{YYYY}" } })
      );
      await createQuote(validInput());
      expect(mockAllocate.mock.calls[0][1].pattern).toBe("QT-{YYYY}{MM}{DD}-{SEQ:3}");
    });

    it("uses the configured pattern", async () => {
      mockSettings.mockResolvedValue(
        testSettings({ quote: { ...testSettings().quote, numberPattern: "{ROC}-{SEQ:4}" } })
      );
      await createQuote(validInput());
      expect(mockAllocate.mock.calls[0][1].pattern).toBe("{ROC}-{SEQ:4}");
    });
  });

  describe("number collisions", () => {
    it("retries on a quotation_number unique violation", async () => {
      mockTransaction.mockRejectedValueOnce(uniqueViolation());
      const res = await createQuote(validInput());
      expect(res).toEqual({ success: true, id: 5 });
      expect(mockTransaction).toHaveBeenCalledTimes(2);
    });

    it("looks through drizzle's wrapped errors", async () => {
      mockTransaction.mockRejectedValueOnce(
        Object.assign(new Error("Failed query"), { cause: uniqueViolation() })
      );
      await expect(createQuote(validInput())).resolves.toMatchObject({ success: true });
      expect(mockTransaction).toHaveBeenCalledTimes(2);
    });

    it("gives up after 3 attempts", async () => {
      mockTransaction.mockRejectedValue(uniqueViolation());
      const res = await createQuote(validInput());
      expect(res).toMatchObject({ success: false, code: "INTERNAL" });
      expect(mockTransaction).toHaveBeenCalledTimes(3);
    });

    it("does not retry other unique violations", async () => {
      mockTransaction.mockRejectedValueOnce(uniqueViolation("customers_pkey"));
      await expect(createQuote(validInput())).resolves.toMatchObject({ code: "INTERNAL" });
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe("INTERNAL", () => {
    it("hides the raw DB error from the client and logs it", async () => {
      mockTransaction.mockRejectedValueOnce(new Error('relation "quotations" does not exist'));
      const res = await createQuote(validInput());
      expect(res).toEqual({ success: false, code: "INTERNAL", message: "Failed to create quote" });
      expect(JSON.stringify(res)).not.toContain("relation");
      expect(console.error).toHaveBeenCalled();
    });

    it("handles non-Error rejections", async () => {
      mockTransaction.mockRejectedValueOnce("string rejection");
      await expect(createQuote(validInput())).resolves.toMatchObject({ code: "INTERNAL" });
    });

    it("returns INTERNAL when settings cannot be loaded", async () => {
      mockSettings.mockRejectedValueOnce(new Error("db down"));
      await expect(createQuote(validInput())).resolves.toMatchObject({ code: "INTERNAL" });
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  describe("minor-unit rounding", () => {
    const input = () =>
      validInput({
        discountType: "percent",
        discountValue: 5,
        taxRate: 5,
        otherFees: 0,
        items: [{ productName: "Widget", quantity: 1, unitPrice: 1003, isTaxable: true }],
      });
    const storedQuote = () =>
      txMock.argsOf("insert", "values").find((v) => (v as Record<string, unknown>).totalAmount !== undefined) as
        | Record<string, unknown>
        | undefined;

    it("stores whole NT$ for TWD so 1,003 − 50 + 48 = 1,001", async () => {
      await expect(createQuote(input())).resolves.toMatchObject({ success: true });
      expect(storedQuote()).toMatchObject({ subtotal: 100_300, discountAmount: 5_000, taxAmount: 4_800, totalAmount: 100_100 });
    });

    it("keeps cents for a two-decimal currency", async () => {
      mockSettings.mockResolvedValue(testSettings({ money: { currency: "USD", currencyLocale: "en-US", fractionDigits: 2 } }));
      await expect(createQuote(input())).resolves.toMatchObject({ success: true });
      expect(storedQuote()).toMatchObject({ discountAmount: 5_015, taxAmount: 4_764, totalAmount: 100_049 });
    });
  });
});
