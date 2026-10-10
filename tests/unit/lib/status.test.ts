import { QUOTE_STATUSES } from "@/db/schema";
import {
  QUOTE_STATUS_VALUES,
  STATUS_TRANSITIONS,
  canTransition,
  displayStatus,
  isDisplayStatus,
  isQuoteStatus,
  normalizeStatus,
} from "@/lib/status";

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
