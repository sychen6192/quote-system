jest.mock("@/lib/auth/guard", () => ({
  assertAuthenticated: jest.fn(),
  isUnauthenticatedError: (e: unknown) => e instanceof Error && e.message === "UNAUTHENTICATED",
}));
jest.mock("@/services/customers", () => ({
  searchCustomerOptions: jest.fn(),
  recentCustomerOptions: jest.fn(),
}));
jest.mock("@/services/products", () => ({ searchProductOptions: jest.fn() }));

import { searchCustomers, searchProducts } from "@/actions/search";
import { assertAuthenticated } from "@/lib/auth/guard";
import { recentCustomerOptions, searchCustomerOptions } from "@/services/customers";
import { searchProductOptions } from "@/services/products";

const mockAuth = assertAuthenticated as jest.Mock;
const mockCustomers = searchCustomerOptions as jest.Mock;
const mockRecent = recentCustomerOptions as jest.Mock;
const mockProducts = searchProductOptions as jest.Mock;

beforeEach(() => {
  mockAuth.mockResolvedValue(undefined);
  mockCustomers.mockResolvedValue([{ companyName: "Acme" }]);
  mockRecent.mockResolvedValue([{ companyName: "Recent Co" }]);
  mockProducts.mockResolvedValue([{ productName: "Widget", unitPrice: 100 }]);
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe.each([
  ["searchCustomers", searchCustomers, mockCustomers],
  ["searchProducts", searchProducts, mockProducts],
] as const)("%s", (_name, action, service) => {
  it.each(["ac", ""])("returns UNAUTHORIZED first (%p)", async (q) => {
    mockAuth.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    await expect(action(q)).resolves.toMatchObject({ success: false, code: "UNAUTHORIZED" });
    expect(service).not.toHaveBeenCalled();
    expect(mockRecent).not.toHaveBeenCalled();
  });

  it("trims, caps the query length and limits to 8 results", async () => {
    const res = await action(`  ${"a".repeat(150)}  `);
    expect(res.success).toBe(true);
    expect(service).toHaveBeenCalledWith("a".repeat(100), 8);
  });

  it("drops NUL and control characters (Postgres rejects NUL)", async () => {
    await action("ac\u0000me");
    expect(service).toHaveBeenCalledWith("acme", 8);
  });

  it("searches with a single character", async () => {
    await action(" 台 ");
    expect(service).toHaveBeenCalledWith("台", 8);
  });

  it("returns INTERNAL (logged) when the query fails", async () => {
    service.mockRejectedValueOnce(new Error("relation does not exist"));
    const res = await action("ac");
    expect(res).toMatchObject({ success: false, code: "INTERNAL" });
    expect(JSON.stringify(res)).not.toContain("relation");
  });
});

describe("searchCustomers with nothing typed", () => {
  it.each(["", "   ", "\u0000", null, 42])("lists the recent customers for %p", async (q) => {
    await expect(searchCustomers(q)).resolves.toEqual({ success: true, data: [{ companyName: "Recent Co" }] });
    expect(mockRecent).toHaveBeenCalledWith(8);
    expect(mockCustomers).not.toHaveBeenCalled();
  });

  it("returns INTERNAL (logged) when the list fails", async () => {
    mockRecent.mockRejectedValueOnce(new Error("relation does not exist"));
    const res = await searchCustomers("");
    expect(res).toMatchObject({ success: false, code: "INTERNAL" });
    expect(JSON.stringify(res)).not.toContain("relation");
  });
});

describe("searchProducts with nothing typed", () => {
  it.each(["", "   ", "\u0000", null, 42])("returns no results for %p without querying", async (q) => {
    await expect(searchProducts(q)).resolves.toEqual({ success: true, data: [] });
    expect(mockProducts).not.toHaveBeenCalled();
  });
});
