import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges Tailwind classes, later ones winning, and drops falsy values", () => {
    expect(cn("p-2", "p-4", false && "hidden")).toBe("p-4");
    expect(cn("text-sm", undefined, null, "font-bold")).toBe("text-sm font-bold");
  });
});
