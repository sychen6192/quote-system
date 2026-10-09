jest.mock("@/db", () => ({ db: { transaction: jest.fn() } }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/auth/guard", () => ({
  assertAuthenticated: jest.fn(),
  isUnauthenticatedError: (e: unknown) => e instanceof Error && e.message === "UNAUTHENTICATED",
}));

import { revalidatePath } from "next/cache";
import { setQuoteStatus } from "@/actions/quote-status";
import { db } from "@/db";
import { assertAuthenticated } from "@/lib/auth/guard";
import { createTxMock } from "./helpers";

const mockTransaction = db.transaction as jest.Mock;
const mockAuth = assertAuthenticated as jest.Mock;

let txMock: ReturnType<typeof createTxMock>;

function useTx(current: string | null | undefined) {
  txMock = createTxMock({ select: [current === undefined ? [] : [{ status: current }]] });
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(txMock.tx));
}

const lastSet = () => txMock.argsOf("update", "set")[0] as Record<string, unknown> | undefined;
const lastEvent = () => txMock.argsOf("insert", "values")[0];

beforeEach(() => {
  mockAuth.mockResolvedValue(undefined);
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe("setQuoteStatus", () => {
  it("returns UNAUTHORIZED first", async () => {
    mockAuth.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    await expect(setQuoteStatus(1, "sent")).resolves.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("validates id and status", async () => {
    await expect(setQuoteStatus("x", "expired")).resolves.toEqual({
      success: false,
      code: "VALIDATION",
      fieldErrors: { id: ["invalidId"], status: ["invalidStatus"] },
    });
    await expect(setQuoteStatus(1, "expired")).resolves.toMatchObject({
      fieldErrors: { status: ["invalidStatus"] },
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for a missing quote", async () => {
    useTx(undefined);
    await expect(setQuoteStatus(5, "sent")).resolves.toMatchObject({ code: "NOT_FOUND" });
  });

  it("draft → sent stamps sentAt and clears decidedAt", async () => {
    useTx("draft");
    await expect(setQuoteStatus(5, "sent")).resolves.toEqual({ success: true, id: 5 });
    const set = lastSet();
    expect(set).toMatchObject({ status: "sent", decidedAt: null });
    expect(set?.sentAt).toBeInstanceOf(Date);
    expect(set?.updatedAt).toBeInstanceOf(Date);
    expect(lastEvent()).toEqual({ quoteId: 5, type: "status_changed", data: { from: "draft", to: "sent" } });
    expect(revalidatePath).toHaveBeenCalledWith("/[locale]", "layout");
  });

  it.each(["accepted", "rejected"])("sent → %s stamps decidedAt", async (to) => {
    useTx("sent");
    await setQuoteStatus(5, to);
    const set = lastSet();
    expect(set?.status).toBe(to);
    expect(set?.decidedAt).toBeInstanceOf(Date);
    expect(set).not.toHaveProperty("sentAt");
  });

  it("accepted → draft clears decidedAt; a null status counts as draft", async () => {
    useTx("accepted");
    await setQuoteStatus(5, "draft");
    expect(lastSet()).toMatchObject({ status: "draft", decidedAt: null });

    useTx(null);
    await setQuoteStatus(5, "accepted");
    expect(lastEvent()).toMatchObject({ data: { from: "draft", to: "accepted" } });
  });

  it("setting the current status again is a successful no-op", async () => {
    useTx("sent");
    await expect(setQuoteStatus(5, "sent")).resolves.toEqual({ success: true, id: 5 });
    expect(txMock.calls.filter((c) => c.op === "update")).toHaveLength(0);
    expect(txMock.calls.filter((c) => c.op === "insert")).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a generic INTERNAL error", async () => {
    mockTransaction.mockRejectedValueOnce(new Error("boom"));
    await expect(setQuoteStatus(5, "sent")).resolves.toEqual({
      success: false,
      code: "INTERNAL",
      message: "Failed to change quote status",
    });
  });
});
