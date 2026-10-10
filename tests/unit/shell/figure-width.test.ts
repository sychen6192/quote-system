import { figureWidthEm } from "@/components/app-shell/format";

describe("figureWidthEm", () => {
  it("counts separators as narrow", () => {
    expect(figureWidthEm("$1,234")).toBeCloseTo(5 * 0.62 + 0.3);
    expect(figureWidthEm("NT$ 1.5")).toBeCloseTo(5 * 0.62 + 2 * 0.3);
  });

  it("grows with the amount, so bigger figures get a smaller font", () => {
    expect(figureWidthEm("$10,001,017,660")).toBeGreaterThan(figureWidthEm("$1,017,660"));
  });

  it("never returns less than 1em (empty or one-character values)", () => {
    expect(figureWidthEm("")).toBe(1);
    expect(figureWidthEm("—")).toBe(1);
  });
});
