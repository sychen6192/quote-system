import { computeFitScale, paneContentWidth } from "@/hooks/use-fit-scale";

describe("computeFitScale", () => {
  it("scales a 794px A4 page down to a 375px phone pane", () => {
    expect(computeFitScale({ availableWidth: 375, contentWidth: 794 })).toBeCloseTo(
      375 / 794,
      3
    );
  });

  it("never scales up when the pane is wider than the page", () => {
    expect(computeFitScale({ availableWidth: 1400, contentWidth: 794 })).toBe(1);
  });

  it("is exactly 1 when the widths match", () => {
    expect(computeFitScale({ availableWidth: 794, contentWidth: 794 })).toBe(1);
  });

  it("returns 1 in 100% mode", () => {
    expect(
      computeFitScale({ availableWidth: 375, contentWidth: 794, enabled: false })
    ).toBe(1);
  });

  it("returns 1 until both sizes are measured", () => {
    expect(computeFitScale({ availableWidth: 0, contentWidth: 794 })).toBe(1);
    expect(computeFitScale({ availableWidth: 375, contentWidth: 0 })).toBe(1);
    expect(computeFitScale({ availableWidth: Number.NaN, contentWidth: 794 })).toBe(1);
  });

  it("respects the minimum scale", () => {
    expect(
      computeFitScale({ availableWidth: 200, contentWidth: 800, minScale: 0.6 })
    ).toBe(0.6);
  });

  it("rounds down so the scaled page never overflows by a sub-pixel", () => {
    const scale = computeFitScale({ availableWidth: 333, contentWidth: 794 });
    expect(scale * 794).toBeLessThanOrEqual(333);
    expect(String(scale).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(4);
  });
});

describe("paneContentWidth", () => {
  const original = (globalThis as { getComputedStyle?: unknown }).getComputedStyle;
  afterEach(() => {
    (globalThis as { getComputedStyle?: unknown }).getComputedStyle = original;
  });

  it("subtracts horizontal padding from clientWidth", () => {
    (globalThis as { getComputedStyle?: unknown }).getComputedStyle = () => ({
      paddingLeft: "16px",
      paddingRight: "24px",
    });
    expect(paneContentWidth({ clientWidth: 400 } as HTMLElement)).toBe(360);
  });

  it("treats unparsable padding as 0", () => {
    (globalThis as { getComputedStyle?: unknown }).getComputedStyle = () => ({
      paddingLeft: "",
      paddingRight: "auto",
    });
    expect(paneContentWidth({ clientWidth: 400 } as HTMLElement)).toBe(400);
  });
});
