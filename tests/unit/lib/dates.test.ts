import {
  addDaysIso,
  daysUntil,
  isExpired,
  isIsoDate,
  isValidTimeZone,
  startOfMonthIso,
  toIsoDate,
  todayInTimeZone,
} from "@/lib/dates";

describe("todayInTimeZone", () => {
  // 2026-10-08T17:30Z is already 2026-10-09 01:30 in Taipei (UTC+8).
  const instant = new Date("2026-10-08T17:30:00Z");

  it("uses the business timezone, not UTC", () => {
    expect(todayInTimeZone("Asia/Taipei", instant)).toBe("2026-10-09");
    expect(todayInTimeZone("UTC", instant)).toBe("2026-10-08");
    expect(todayInTimeZone("America/Los_Angeles", instant)).toBe("2026-10-08");
  });

  it("falls back to UTC for an invalid zone", () => {
    expect(todayInTimeZone("Mars/Olympus", instant)).toBe("2026-10-08");
    expect(todayInTimeZone("", instant)).toBe("2026-10-08");
  });

  it("returns YYYY-MM-DD for the current time", () => {
    expect(todayInTimeZone("Asia/Taipei")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("isIsoDate / isValidTimeZone / toIsoDate", () => {
  it.each([
    ["2026-10-09", true],
    ["2024-02-29", true],
    ["2026-02-29", false],
    ["2026-13-01", false],
    ["2026-1-9", false],
    ["20261009", false],
    ["", false],
    [null, false],
  ])("isIsoDate(%p) = %p", (value, expected) => {
    expect(isIsoDate(value)).toBe(expected);
  });

  it("validates time zones", () => {
    expect(isValidTimeZone("Asia/Taipei")).toBe(true);
    expect(isValidTimeZone("Nope/Nope")).toBe(false);
  });

  it("normalises DB values", () => {
    expect(toIsoDate("2026-10-09")).toBe("2026-10-09");
    expect(toIsoDate("2026-10-09 00:00:00")).toBe("2026-10-09");
    expect(toIsoDate(new Date("2026-10-09T00:00:00Z"))).toBe("2026-10-09");
    expect(toIsoDate(new Date("nope"))).toBeNull();
    expect(toIsoDate("")).toBeNull();
    expect(toIsoDate(null)).toBeNull();
    expect(toIsoDate("garbage")).toBeNull();
  });
});

describe("date arithmetic", () => {
  it.each([
    ["2026-10-09", 30, "2026-11-08"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2024-02-28", 1, "2024-02-29"],
    ["2026-03-01", -1, "2026-02-28"],
    ["2026-03-08", 1, "2026-03-09"], // US DST change does not matter in UTC math
  ])("addDaysIso(%s, %i) = %s", (iso, days, expected) => {
    expect(addDaysIso(iso, days)).toBe(expected);
  });

  it("computes whole days between dates", () => {
    expect(daysUntil("2026-10-16", "2026-10-09")).toBe(7);
    expect(daysUntil("2026-10-09", "2026-10-09")).toBe(0);
    expect(daysUntil("2026-10-08", "2026-10-09")).toBe(-1);
  });

  it("finds the start of the month", () => {
    expect(startOfMonthIso("2026-10-09")).toBe("2026-10-01");
  });

  it("throws on malformed input", () => {
    expect(() => addDaysIso("nope", 1)).toThrow();
  });
});

describe("isExpired", () => {
  const today = "2026-10-09";
  it.each([
    ["2026-10-08", "draft", true],
    ["2026-10-08", "sent", true],
    ["2026-10-08", null, true],
    ["2026-10-08", "", true],
    ["2026-10-09", "sent", false], // valid through the whole last day
    ["2026-10-10", "draft", false],
    ["2026-10-08", "accepted", false],
    ["2026-10-08", "rejected", false],
    [null, "sent", false],
  ])("validUntil %p, status %p → %p", (validUntil, status, expected) => {
    expect(isExpired(validUntil, status, today)).toBe(expected);
  });
});
