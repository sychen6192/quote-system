jest.mock("@/lib/auth/guard", () => ({
  assertAuthenticated: jest.fn(),
  isUnauthenticatedError: (e: unknown) => e instanceof Error && e.message === "UNAUTHENTICATED",
}));
jest.mock("@/services/customers", () => ({
  searchCustomerOptions: jest.fn(),
  recentCustomerOptions: jest.fn(),
}));
jest.mock("@/services/products", () => ({
  searchProductOptions: jest.fn(),
  recentProductOptions: jest.fn(),
}));

import { searchCustomers, searchProducts } from "@/actions/search";
import { assertAuthenticated } from "@/lib/auth/guard";
import { recentCustomerOptions, searchCustomerOptions } from "@/services/customers";
import { recentProductOptions, searchProductOptions } from "@/services/products";

const mockAuth = assertAuthenticated as jest.Mock;
const mockCustomers = searchCustomerOptions as jest.Mock;
const mockRecent = recentCustomerOptions as jest.Mock;
const mockProducts = searchProductOptions as jest.Mock;
const mockRecentProducts = recentProductOptions as jest.Mock;

beforeEach(() => {
  mockAuth.mockResolvedValue(undefined);
  mockCustomers.mockResolvedValue([{ companyName: "Acme" }]);
  mockRecent.mockResolvedValue([{ companyName: "Recent Co" }]);
  mockProducts.mockResolvedValue([{ productName: "Widget", unitPrice: 100 }]);
  mockRecentProducts.mockResolvedValue([{ productName: "Recent item", unitPrice: 200 }]);
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe.each([
  ["searchCustomers", searchCustomers, mockCustomers, mockRecent],
  ["searchProducts", searchProducts, mockProducts, mockRecentProducts],
] as const)("%s", (_name, action, service, recent) => {
  it.each(["ac", ""])("returns UNAUTHORIZED first (%p)", async (q) => {
    mockAuth.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    await expect(action(q)).resolves.toMatchObject({ success: false, code: "UNAUTHORIZED" });
    expect(service).not.toHaveBeenCalled();
    expect(recent).not.toHaveBeenCalled();
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

describe.each([
  ["searchCustomers", searchCustomers, mockCustomers, mockRecent, { companyName: "Recent Co" }],
  ["searchProducts", searchProducts, mockProducts, mockRecentProducts, { productName: "Recent item", unitPrice: 200 }],
] as const)("%s with nothing typed", (_name, action, service, recent, first) => {
  it.each(["", "   ", "\u0000", null, 42])("lists the most recent entries for %p", async (q) => {
    await expect(action(q)).resolves.toEqual({ success: true, data: [first] });
    expect(recent).toHaveBeenCalledWith(8);
    expect(service).not.toHaveBeenCalled();
  });

  it("returns INTERNAL (logged) when the list fails", async () => {
    recent.mockRejectedValueOnce(new Error("relation does not exist"));
    const res = await action("");
    expect(res).toMatchObject({ success: false, code: "INTERNAL" });
    expect(JSON.stringify(res)).not.toContain("relation");
  });
});
