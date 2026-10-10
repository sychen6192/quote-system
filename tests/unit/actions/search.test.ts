jest.mock("@/lib/auth/guard", () => ({
  assertAuthenticated: jest.fn(),
  isUnauthenticatedError: (e: unknown) => e instanceof Error && e.message === "UNAUTHENTICATED",
}));
jest.mock("@/services/customers", () => ({ searchCustomerOptions: jest.fn() }));
jest.mock("@/services/products", () => ({ searchProductOptions: jest.fn() }));

import { searchCustomers, searchProducts } from "@/actions/search";
import { assertAuthenticated } from "@/lib/auth/guard";
import { searchCustomerOptions } from "@/services/customers";
import { searchProductOptions } from "@/services/products";

const mockAuth = assertAuthenticated as jest.Mock;
const mockCustomers = searchCustomerOptions as jest.Mock;
const mockProducts = searchProductOptions as jest.Mock;

beforeEach(() => {
  mockAuth.mockResolvedValue(undefined);
  mockCustomers.mockResolvedValue([{ companyName: "Acme" }]);
  mockProducts.mockResolvedValue([{ productName: "Widget", unitPrice: 100 }]);
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe.each([
  ["searchCustomers", searchCustomers, mockCustomers],
  ["searchProducts", searchProducts, mockProducts],
] as const)("%s", (_name, action, service) => {
  it("returns UNAUTHORIZED first", async () => {
    mockAuth.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    await expect(action("ac")).resolves.toMatchObject({ success: false, code: "UNAUTHORIZED" });
    expect(service).not.toHaveBeenCalled();
  });

  it.each(["", "   ", null, 42])("returns no results for %p without querying", async (q) => {
    await expect(action(q)).resolves.toEqual({ success: true, data: [] });
    expect(service).not.toHaveBeenCalled();
  });

  it("trims, caps the query length and limits to 8 results", async () => {
    const res = await action(`  ${"a".repeat(150)}  `);
    expect(res.success).toBe(true);
    expect(service).toHaveBeenCalledWith("a".repeat(100), 8);
  });

  it("drops NUL and control characters (Postgres rejects NUL)", async () => {
    await expect(action("\u0000")).resolves.toEqual({ success: true, data: [] });
    expect(service).not.toHaveBeenCalled();
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
