jest.mock("@/db", () => ({ db: { transaction: jest.fn() } }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/auth/guard", () => ({
  assertAuthenticated: jest.fn(),
  isUnauthenticatedError: (e: unknown) => e instanceof Error && e.message === "UNAUTHENTICATED",
}));

import { revalidatePath } from "next/cache";
import { updateQuote } from "@/actions/update-quote";
import { db } from "@/db";
import { assertAuthenticated } from "@/lib/auth/guard";
import { createTxMock } from "./helpers";

const mockTransaction = db.transaction as jest.Mock;
const mockAuth = assertAuthenticated as jest.Mock;

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    companyName: "Acme Corp",
    contactPerson: "Jane Doe",
    email: "jane@acme.test",
    phone: "+886-2-1234-5678",
    address: "Taipei",
    vatNumber: "12345678",
    title: "Phase 2",
    salesperson: "Alice",
    issuedDate: "2026-04-01",
    validUntil: "2026-05-01",
    shippingDate: "2026-04-20",
    paymentMethod: "貨到付款",
    shippingMethod: "自取",
    taxRate: 5,
    discountType: "percent",
    discountValue: 10,
    otherFees: 0,
    notes: "Note",
    terms: "Terms",
    items: [
      { productName: "Widget", quantity: 2, unitPrice: 100, isTaxable: true },
      { productName: "Manual", description: "PDF", quantity: 1, unitPrice: 0, isTaxable: false },
    ],
    ...overrides,
  };
}

let txMock: ReturnType<typeof createTxMock>;

function useTx(queues: Parameters<typeof createTxMock>[0]) {
  txMock = createTxMock(queues);
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(txMock.tx));
}

beforeEach(() => {
  mockAuth.mockResolvedValue(undefined);
  useTx({ select: [[{ id: 1, customerId: 42 }], [{ n: 0 }]] });
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe("updateQuote", () => {
  it("returns UNAUTHORIZED first", async () => {
    mockAuth.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    await expect(updateQuote(1, validInput())).resolves.toMatchObject({
      success: false,
      code: "UNAUTHORIZED",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, "1", 2_147_483_648, null, NaN])("rejects id %p", async (id) => {
    const res = await updateQuote(id, validInput());
    expect(res).toEqual({ success: false, code: "VALIDATION", fieldErrors: { id: ["invalidId"] } });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("rejects invalid data without touching the DB", async () => {
    const res = await updateQuote(1, validInput({ companyName: "", validUntil: "2026-03-01" }));
    expect(res).toMatchObject({ success: false, code: "VALIDATION" });
    if (!res.success && res.code === "VALIDATION") {
      expect(res.fieldErrors.companyName).toEqual(["required"]);
      expect(res.fieldErrors.validUntil).toEqual(["validUntilBeforeIssued"]);
    }
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when the quote does not exist", async () => {
    useTx({ select: [[]] });
    const res = await updateQuote(999, validInput());
    expect(res).toMatchObject({ success: false, code: "NOT_FOUND" });
    if (!res.success && res.code === "NOT_FOUND") expect(res.message).toContain("999");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("persists every field, replaces items and logs an event", async () => {
    const res = await updateQuote(1, validInput());
    expect(res).toEqual({ success: true, id: 1 });

    const firstSelect = txMock.calls.find((c) => c.op === "select");
    expect(firstSelect?.chain.map((l) => l.method)).toContain("for");

    const [customerSet, quoteSet] = txMock.argsOf("update", "set") as Record<string, unknown>[];
    expect(customerSet).toMatchObject({ companyName: "Acme Corp", phone: "+886-2-1234-5678" });
    expect(quoteSet).toMatchObject({
      customerId: 42,
      title: "Phase 2",
      shippingDate: "2026-04-20",
      paymentMethod: "貨到付款",
      shippingMethod: "自取",
      notes: "Note",
      terms: "Terms",
      discountType: "percent",
      discountValue: 1000,
      subtotal: 20_000,
      discountAmount: 2_000,
      taxRate: 500,
      taxAmount: 900,
      totalAmount: 18_900,
    });
    expect(quoteSet.updatedAt).toBeInstanceOf(Date);

    expect(txMock.calls.filter((c) => c.op === "delete")).toHaveLength(1);
    const [items, event] = txMock.argsOf("insert", "values");
    expect(items).toEqual([
      { position: 0, productName: "Widget", description: null, unit: null, quantity: 2, unitPrice: 10_000, isTaxable: true, quotationId: 1 },
      { position: 1, productName: "Manual", description: "PDF", unit: null, quantity: 1, unitPrice: 0, isTaxable: false, quotationId: 1 },
    ]);
    expect(event).toEqual({ quoteId: 1, type: "updated", data: {} });
    expect(revalidatePath).toHaveBeenCalledWith("/[locale]", "layout");
  });

  it("gives the quote its own snapshot when the customer row is shared", async () => {
    useTx({ select: [[{ id: 1, customerId: 42 }], [{ n: 2 }]], insert: [[{ id: 99 }]] });
    await expect(updateQuote(1, validInput())).resolves.toEqual({ success: true, id: 1 });
    const [customerValues] = txMock.argsOf("insert", "values");
    expect(customerValues).toMatchObject({ companyName: "Acme Corp" });
    const sets = txMock.argsOf("update", "set") as Record<string, unknown>[];
    expect(sets).toHaveLength(1); // only the quote, never the shared customer row
    expect(sets[0].customerId).toBe(99);
  });

  it("creates a snapshot for legacy quotes without a customer", async () => {
    useTx({ select: [[{ id: 1, customerId: null }]], insert: [[{ id: 7 }]] });
    await expect(updateQuote(1, validInput())).resolves.toEqual({ success: true, id: 1 });
    expect((txMock.argsOf("update", "set")[0] as Record<string, unknown>).customerId).toBe(7);
  });

  it("returns a generic INTERNAL error and logs the cause", async () => {
    mockTransaction.mockRejectedValueOnce(new Error("deadlock detected"));
    const res = await updateQuote(1, validInput());
    expect(res).toEqual({ success: false, code: "INTERNAL", message: "Failed to update quote" });
    expect(console.error).toHaveBeenCalled();
  });
});
