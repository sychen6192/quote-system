jest.mock("@/db", () => ({ db: { transaction: jest.fn() } }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/auth/guard", () => ({
  assertAuthenticated: jest.fn(),
  isUnauthenticatedError: (e: unknown) => e instanceof Error && e.message === "UNAUTHENTICATED",
}));

import { revalidatePath } from "next/cache";
import { deleteQuote } from "@/actions/delete-quote";
import { db } from "@/db";
import { assertAuthenticated } from "@/lib/auth/guard";
import { createTxMock } from "./helpers";

const mockTransaction = db.transaction as jest.Mock;
const mockAuth = assertAuthenticated as jest.Mock;

let txMock: ReturnType<typeof createTxMock>;

function useTx(queues: Parameters<typeof createTxMock>[0]) {
  txMock = createTxMock(queues);
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(txMock.tx));
}

beforeEach(() => {
  mockAuth.mockResolvedValue(undefined);
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe("deleteQuote", () => {
  it("returns UNAUTHORIZED first", async () => {
    mockAuth.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    await expect(deleteQuote(1)).resolves.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it.each([0, "1", 1.5, -3, undefined])("rejects id %p", async (id) => {
    await expect(deleteQuote(id)).resolves.toEqual({
      success: false,
      code: "VALIDATION",
      fieldErrors: { id: ["invalidId"] },
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when nothing was deleted", async () => {
    useTx({ delete: [[], []] });
    await expect(deleteQuote(999)).resolves.toMatchObject({ success: false, code: "NOT_FOUND" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("deletes the quote and its now-unreferenced customer snapshot", async () => {
    useTx({ delete: [[], [{ customerId: 42 }], []] });
    await expect(deleteQuote(1)).resolves.toEqual({ success: true, id: 1 });
    const deletes = txMock.calls.filter((c) => c.op === "delete");
    expect(deletes).toHaveLength(3); // items, quote, customer (guarded by NOT EXISTS)
    expect(revalidatePath).toHaveBeenCalledWith("/[locale]", "layout");
  });

  it("skips the customer delete for legacy quotes without one", async () => {
    useTx({ delete: [[], [{ customerId: null }]] });
    await expect(deleteQuote(1)).resolves.toEqual({ success: true, id: 1 });
    expect(txMock.calls.filter((c) => c.op === "delete")).toHaveLength(2);
  });

  it("returns a generic INTERNAL error when the transaction throws", async () => {
    mockTransaction.mockRejectedValueOnce(new Error("DB down"));
    await expect(deleteQuote(1)).resolves.toEqual({
      success: false,
      code: "INTERNAL",
      message: "Failed to delete quote",
    });
    expect(console.error).toHaveBeenCalled();
  });
});
