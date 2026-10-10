import { QUOTE_STATUSES } from "@/db/schema";
import {
  QUOTE_STATUS_VALUES,
  STATUS_TRANSITIONS,
  canTransition,
  displayStatus,
  expiredStyle,
  isDisplayStatus,
  isQuoteStatus,
  normalizeStatus,
  statusStyle,
} from "@/lib/status";

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

  it("omits dark: variants when forceLight is set", () => {
    const light = statusStyle("sent", true);
    expect(light).toContain("blue");
    expect(light).not.toContain("dark:");
  });

  it("styles the derived expired status", () => {
    expect(statusStyle("expired")).toBe(expiredStyle());
    expect(statusStyle("expired", true)).toBe(expiredStyle(true));
  });
});

describe("status helpers", () => {
  it("stays in sync with the DB enum", () => {
    expect([...QUOTE_STATUS_VALUES]).toEqual([...QUOTE_STATUSES]);
  });

  it("recognises statuses", () => {
    expect(isQuoteStatus("sent")).toBe(true);
    expect(isQuoteStatus("expired")).toBe(false);
    expect(isQuoteStatus(undefined)).toBe(false);
    expect(isDisplayStatus("expired")).toBe(true);
    expect(isDisplayStatus("nope")).toBe(false);
    expect(normalizeStatus(null)).toBe("draft");
    expect(normalizeStatus("weird")).toBe("draft");
    expect(normalizeStatus("accepted")).toBe("accepted");
  });

  it("derives the display status (only draft/sent expire)", () => {
    const today = "2026-10-09";
    expect(displayStatus("sent", "2026-10-08", today)).toBe("expired");
    expect(displayStatus(null, "2026-10-08", today)).toBe("expired");
    expect(displayStatus("sent", "2026-10-09", today)).toBe("sent");
    expect(displayStatus("accepted", "2026-10-01", today)).toBe("accepted");
    expect(displayStatus("rejected", "2026-10-01", today)).toBe("rejected");
  });

  it("allows any status change except to the same status", () => {
    for (const from of QUOTE_STATUS_VALUES) {
      for (const to of QUOTE_STATUS_VALUES) {
        expect(canTransition(from, to)).toBe(from !== to);
      }
      expect(STATUS_TRANSITIONS[from]).toHaveLength(QUOTE_STATUS_VALUES.length - 1);
    }
  });
});
