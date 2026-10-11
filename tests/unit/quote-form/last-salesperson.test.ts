import {
  LAST_SALESPERSON_COOKIE,
  lastSalespersonCookie,
  readLastSalesperson,
} from "@/components/quote-form/last-salesperson";

describe("last salesperson cookie", () => {
  it("remembers the trimmed name for a year, encoded", () => {
    expect(lastSalespersonCookie("  王小明 ")).toBe(
      `${LAST_SALESPERSON_COOKIE}=${encodeURIComponent("王小明")}; path=/; max-age=31536000; samesite=lax`
    );
    expect(lastSalespersonCookie("Ann; path=/x")).toContain(`=${encodeURIComponent("Ann; path=/x")};`);
  });

  it("forgets it for a blank or unusable name", () => {
    const forget = `${LAST_SALESPERSON_COOKIE}=; path=/; max-age=0; samesite=lax`;
    expect(lastSalespersonCookie("   ")).toBe(forget);
    expect(lastSalespersonCookie("a".repeat(101))).toBe(forget);
    expect(lastSalespersonCookie("Ann\u0000")).toBe(forget);
  });

  it("reads the value Next has decoded, rejecting what the form would refuse", () => {
    expect(readLastSalesperson(undefined)).toBe("");
    expect(readLastSalesperson("")).toBe("");
    expect(readLastSalesperson(" 王小明 ")).toBe("王小明");
    expect(readLastSalesperson("50% Sales")).toBe("50% Sales");
    expect(readLastSalesperson("a".repeat(101))).toBe("");
    expect(readLastSalesperson("Ann\nBob")).toBe("");
  });
});
