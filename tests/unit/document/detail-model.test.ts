import {
  activityEntries,
  looksLikeEmail,
  relativeTime,
  splitEmailList,
  validityOf,
} from "@/components/quote-detail/model";

describe("validityOf", () => {
  const today = "2026-10-09";
  it.each<[string, Parameters<typeof validityOf>[2], ReturnType<typeof validityOf>]>([
    ["2026-11-08", "sent", { kind: "open", days: 30 }],
    ["2026-10-16", "draft", { kind: "soon", days: 7 }],
    ["2026-10-09", "sent", { kind: "soon", days: 0 }],
    ["2026-10-08", "expired", { kind: "expired", days: 1 }],
    ["2026-09-01", "accepted", { kind: "closed" }],
    ["2026-09-01", "rejected", { kind: "closed" }],
    ["", "draft", { kind: "closed" }],
  ])("%s / %s", (validUntil, status, expected) => {
    expect(validityOf(validUntil, today, status)).toEqual(expected);
  });
});

describe("relativeTime", () => {
  const now = Date.UTC(2026, 9, 9, 12, 0, 0);
  it.each<[number, ReturnType<typeof relativeTime>]>([
    [now - 30_000, null],
    [now - 47 * 60_000, { value: -47, unit: "minute" }],
    [now - 3 * 3_600_000, { value: -3, unit: "hour" }],
    [now - 2 * 86_400_000, { value: -2, unit: "day" }],
    [now - 15 * 86_400_000, { value: -2, unit: "week" }],
    [now - 45 * 86_400_000, { value: -1, unit: "month" }],
    [now - 400 * 86_400_000, { value: -1, unit: "year" }],
    [now + 2 * 3_600_000, { value: 2, unit: "hour" }],
  ])("%p", (then, expected) => {
    expect(relativeTime(then, now)).toEqual(expected);
  });
});

describe("email helpers", () => {
  it("splits on commas, semicolons, spaces and full-width separators, without duplicates", () => {
    expect(splitEmailList(" a@x.tw, b@x.tw;c@x.tw  A@X.tw，d@x.tw；")).toEqual([
      "a@x.tw",
      "b@x.tw",
      "c@x.tw",
      "d@x.tw",
    ]);
    expect(splitEmailList("  ")).toEqual([]);
  });

  it.each([
    ["ming.wang@hongda.com.tw", true],
    ["a+tag@x.io", true],
    ["nope", false],
    ["a@b", false],
    ["a..b@x.tw", false],
    ["a b@x.tw", false],
  ])("looksLikeEmail(%p) = %p", (value, expected) => {
    expect(looksLikeEmail(value)).toBe(expected);
  });
});

describe("activityEntries", () => {
  const at = "2026-10-09T03:00:00.000Z";
  it("normalises the stored events", () => {
    expect(
      activityEntries([
        { id: 1, type: "created", data: { quotationNumber: "QT-1" }, createdAt: at },
        { id: 2, type: "status_changed", data: { from: "draft", to: "sent" }, createdAt: at },
        { id: 3, type: "status_changed", data: { to: "bogus" }, createdAt: at },
        { id: 4, type: "emailed", data: { to: "a@x.tw", cc: ["b@x.tw", 3, ""] }, createdAt: at },
        { id: 5, type: "emailed", data: null, createdAt: at },
        { id: 6, type: "something_new", data: {}, createdAt: at },
        { id: 7, type: "status_changed", data: { from: "nope", to: "accepted" }, createdAt: at },
      ])
    ).toEqual([
      { id: 1, at, kind: "created" },
      { id: 2, at, kind: "status", from: "draft", to: "sent" },
      { id: 3, at, kind: "updated" },
      { id: 4, at, kind: "emailed", to: "a@x.tw", cc: ["b@x.tw"] },
      { id: 5, at, kind: "emailed", to: "", cc: [] },
      { id: 6, at, kind: "unknown" },
      { id: 7, at, kind: "status", from: null, to: "accepted" },
    ]);
  });
});
