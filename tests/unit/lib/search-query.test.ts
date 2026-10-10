import { firstParam, normalizeSearchQuery } from "@/lib/search-query";

describe("normalizeSearchQuery", () => {
  it.each([
    ["a\u0000b", "ab"],
    ["\u0000", ""],
    ["  acme\t corp \n", "acme corp"],
    ["x\u007fy\u001b", "xy"],
    ["台北 公司", "台北 公司"],
    ["50%_off", "50%_off"],
  ])("%j → %j", (raw, expected) => expect(normalizeSearchQuery(raw)).toBe(expected));

  it("caps the length after cleaning", () => {
    expect(normalizeSearchQuery(`${"\u0000".repeat(5)}${"a".repeat(150)}`)).toHaveLength(100);
    expect(normalizeSearchQuery("abcdef", 3)).toBe("abc");
  });

  it("takes the first value of repeated params and ignores non-strings", () => {
    expect(normalizeSearchQuery(["a\u0000", "b"])).toBe("a");
    expect(normalizeSearchQuery(undefined)).toBe("");
    expect(normalizeSearchQuery(null)).toBe("");
    expect(normalizeSearchQuery(42)).toBe("");
    expect(firstParam([["x"]])).toBe("x");
  });
});
