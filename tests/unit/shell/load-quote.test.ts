const assertAuthenticated = jest.fn();
const getQuoteById = jest.fn();

jest.mock("@/lib/auth/guard", () => ({ assertAuthenticated: () => assertAuthenticated() }));
jest.mock("@/services/quotes", () => ({ getQuoteById: (id: number) => getQuoteById(id) }));

import { loadQuote as loadForDetail } from "@/app/[locale]/quotes/[id]/(detail)/load-quote";
import { loadQuote as loadForEdit } from "@/app/[locale]/quotes/[id]/edit/load-quote";

beforeEach(() => {
  jest.clearAllMocks();
  getQuoteById.mockResolvedValue({ id: 7, quotationNumber: "QT-7" });
});

describe.each([
  ["detail", loadForDetail],
  ["edit", loadForEdit],
])("loadQuote (%s)", (_name, loadQuote) => {
  it("reads the quote for a signed-in request", async () => {
    assertAuthenticated.mockResolvedValue(undefined);
    await expect(loadQuote(7)).resolves.toMatchObject({ id: 7 });
    expect(getQuoteById).toHaveBeenCalledWith(7);
  });

  it("never queries for a signed-out request", async () => {
    assertAuthenticated.mockRejectedValue(new Error("UNAUTHENTICATED"));
    await expect(loadQuote(8)).rejects.toThrow("UNAUTHENTICATED");
    expect(getQuoteById).not.toHaveBeenCalled();
  });
});
