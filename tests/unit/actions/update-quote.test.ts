jest.mock("@/db", () => ({ db: { transaction: jest.fn() } }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/auth/guard", () => ({
  assertAuthenticated: jest.fn(),
  isUnauthenticatedError: (e: unknown) => e instanceof Error && e.message === "UNAUTHENTICATED",
}));
jest.mock("@/services/settings", () => ({ getSettings: jest.fn() }));

import { revalidatePath } from "next/cache";
import { updateQuote } from "@/actions/update-quote";
import { db } from "@/db";
import { assertAuthenticated } from "@/lib/auth/guard";
import { getSettings } from "@/services/settings";
import { createTxMock, testSettings } from "./helpers";

const mockTransaction = db.transaction as jest.Mock;
const mockAuth = assertAuthenticated as jest.Mock;
const mockSettings = getSettings as jest.Mock;

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
  mockSettings.mockResolvedValue(testSettings());
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

  it("returns INTERNAL when settings cannot be loaded", async () => {
    mockSettings.mockRejectedValueOnce(new Error("db down"));
    const res = await updateQuote(1, validInput());
    expect(res).toMatchObject({ success: false, code: "INTERNAL" });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  // TWD is shown without decimals: stored figures must be whole NT$ so the
  // list, dashboard and CSV add up like the document.
  it("stores whole displayed units for a zero-decimal currency", async () => {
    const input = validInput({
      discountType: "percent",
      discountValue: 5,
      taxRate: 5,
      otherFees: 0,
      items: [{ productName: "Widget", quantity: 1, unitPrice: 1003, isTaxable: true }],
    });
    await updateQuote(1, input);
    const quoteSet = txMock.argsOf("update", "set")[1] as Record<string, unknown>;
    expect(quoteSet).toMatchObject({ subtotal: 100_300, discountAmount: 5_000, taxAmount: 4_800, totalAmount: 100_100 });

    mockSettings.mockResolvedValue(testSettings({ money: { currency: "USD", currencyLocale: "en-US", fractionDigits: 2 } }));
    useTx({ select: [[{ id: 1, customerId: 42 }], [{ n: 0 }]] });
    await updateQuote(1, input);
    const usd = txMock.argsOf("update", "set")[1] as Record<string, unknown>;
    expect(usd).toMatchObject({ subtotal: 100_300, discountAmount: 5_015, taxAmount: 4_764, totalAmount: 100_049 });
  });
});

// Two open editors (phone and desktop) must not silently overwrite each other.
describe("updateQuote: concurrent edits", () => {
  const loadedAt = new Date("2026-10-10T07:40:33.123Z");

  it("returns CONFLICT and writes nothing when the quote changed since it was loaded", async () => {
    useTx({ select: [[{ id: 1, customerId: 42, updatedAt: new Date("2026-10-10T07:45:00.000Z") }], [{ n: 0 }]] });
    const res = await updateQuote(1, validInput(), loadedAt.toISOString());
    expect(res).toMatchObject({ success: false, code: "CONFLICT" });
    expect(txMock.calls.filter((c) => c.op !== "select")).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["ISO string", loadedAt.toISOString()],
    ["epoch ms", loadedAt.getTime()],
    ["Date", loadedAt],
  ])("saves when the version matches (%s)", async (_label, expected) => {
    useTx({ select: [[{ id: 1, customerId: 42, updatedAt: new Date(loadedAt) }], [{ n: 0 }]] });
    await expect(updateQuote(1, validInput(), expected)).resolves.toEqual({ success: true, id: 1 });
    const firstSelect = txMock.calls.find((c) => c.op === "select");
    expect(Object.keys(firstSelect?.args[0] as object)).toContain("updatedAt");
  });

  it("treats null as 'never edited' and conflicts once someone has", async () => {
    useTx({ select: [[{ id: 1, customerId: 42, updatedAt: null }], [{ n: 0 }]] });
    await expect(updateQuote(1, validInput(), null)).resolves.toEqual({ success: true, id: 1 });
    useTx({ select: [[{ id: 1, customerId: 42, updatedAt: loadedAt }], [{ n: 0 }]] });
    await expect(updateQuote(1, validInput(), null)).resolves.toMatchObject({ code: "CONFLICT" });
  });

  it("skips the check without an expected version ('save anyway')", async () => {
    useTx({ select: [[{ id: 1, customerId: 42, updatedAt: new Date() }], [{ n: 0 }]] });
    await expect(updateQuote(1, validInput())).resolves.toEqual({ success: true, id: 1 });
  });

  it.each(["yesterday", NaN, {}, true])("rejects a malformed expected version %p", async (expected) => {
    // Typed for callers, but a Server Action receives whatever is sent.
    const res = await updateQuote(1, validInput(), expected as never);
    expect(res).toEqual({ success: false, code: "VALIDATION", fieldErrors: { expectedUpdatedAt: ["invalidValue"] } });
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
