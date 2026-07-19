import { statusStyle } from "@/lib/status";

describe("statusStyle", () => {
  it("maps each known status to its own class set", () => {
    const draft = statusStyle("draft");
    const sent = statusStyle("sent");
    const accepted = statusStyle("accepted");
    const rejected = statusStyle("rejected");
    expect(draft).toContain("slate");
    expect(sent).toContain("blue");
    expect(accepted).toContain("green");
    expect(rejected).toContain("red");
    // all include a dark: variant
    for (const c of [draft, sent, accepted, rejected]) {
      expect(c).toContain("dark:");
    }
  });

  it("falls back to draft styling for unknown/empty status", () => {
    expect(statusStyle("weird")).toBe(statusStyle("draft"));
    expect(statusStyle("")).toBe(statusStyle("draft"));
  });
});
