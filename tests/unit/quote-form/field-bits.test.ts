import { prefixPadding } from "@/components/quote-form/field-bits";

describe("prefixPadding", () => {
  it("keeps the old 32px for a one-character symbol", () => {
    expect(prefixPadding("$", 8.5)).toBe("32px");
  });

  // "IDR1500000": a 3-letter symbol used to run into the value under pl-8.
  it("makes room for wide symbols once measured", () => {
    expect(prefixPadding("IDR", 26)).toBe("44px");
    expect(prefixPadding("NT$", 27.4)).toBe("46px");
  });

  it("estimates from the symbol's length before it is measured (server render)", () => {
    expect(prefixPadding("IDR", null)).toBe("max(32px, calc(3ch + 18px))");
    expect(prefixPadding("$", 0)).toBe("max(32px, calc(1ch + 18px))");
  });
});
