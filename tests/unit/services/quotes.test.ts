jest.mock("@/db", () => ({ db: { query: { quotations: { findFirst: jest.fn() } } } }));
jest.mock("@/services/settings", () => ({ getSettings: jest.fn() }));

import { PgDialect } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  escapeLike,
  getQuoteById,
  normalizeQuoteListParams,
  paginate,
  quoteSearchCondition,
  quoteStatusCondition,
  resolveToday,
  rowsOf,
} from "@/services/quotes";
import { getSettings } from "@/services/settings";

const findFirst = (db as unknown as { query: { quotations: { findFirst: jest.Mock } } }).query
  .quotations.findFirst;
const dialect = new PgDialect();

describe("normalizeQuoteListParams", () => {
  it("applies defaults", () => {
    expect(normalizeQuoteListParams({})).toEqual({
      q: "",
      status: null,
      sort: "newest",
      page: 1,
      pageSize: 20,
    });
  });

  it("keeps valid values", () => {
    expect(
      normalizeQuoteListParams({ q: "  acme ", status: "expired", sort: "amount_desc", page: "3", pageSize: 50 })
    ).toEqual({ q: "acme", status: "expired", sort: "amount_desc", page: 3, pageSize: 50 });
  });

  it.each([
    [{ page: "-1" }, { page: 1 }],
    [{ page: "1.9" }, { page: 1 }],
    [{ page: "abc" }, { page: 1 }],
    [{ page: "0" }, { page: 1 }],
    [{ pageSize: 0 }, { pageSize: 20 }],
    [{ pageSize: 5000 }, { pageSize: 100 }],
    [{ status: "bogus" }, { status: null }],
    [{ sort: "drop table" }, { sort: "newest" }],
    [{ q: "x".repeat(300) }, { q: "x".repeat(100) }],
  ])("sanitises %j", (input, expected) => {
    expect(normalizeQuoteListParams(input)).toMatchObject(expected);
  });

  it("takes the first value of repeated search params", () => {
    expect(
      normalizeQuoteListParams({ status: ["sent", "draft"], page: ["2", "3"] })
    ).toMatchObject({ status: "sent", page: 2 });
  });
});

describe("paginate", () => {
  it.each([
    [1, 0, 20, { page: 1, totalPages: 1, offset: 0 }],
    [5, 0, 20, { page: 1, totalPages: 1, offset: 0 }],
    [2, 41, 20, { page: 2, totalPages: 3, offset: 20 }],
    [999, 41, 20, { page: 3, totalPages: 3, offset: 40 }],
    [-4, 41, 20, { page: 1, totalPages: 3, offset: 0 }],
    [NaN, 41, 20, { page: 1, totalPages: 3, offset: 0 }],
  ])("paginate(%p, %p, %p)", (page, total, size, expected) => {
    expect(paginate(page, total, size)).toEqual(expected);
  });
});

describe("SQL fragments", () => {
  it("escapes LIKE wildcards", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });

  it("searches number, title, company and contact with an escaped pattern", () => {
    const query = dialect.sqlToQuery(quoteSearchCondition("10%")!);
    expect(query.sql).toMatch(/"quotations"\."quotation_number" ilike \$1/);
    expect(query.sql).toMatch(/"customers"\."contact_person" ilike \$4/);
    expect(query.params).toEqual(["%10\\%%", "%10\\%%", "%10\\%%", "%10\\%%"]);
    expect(quoteSearchCondition("")).toBeUndefined();
  });

  it.each([
    ["sent", /= \$1 and "quotations"\."valid_until" >= \$2/, ["sent", "2026-10-09"]],
    ["accepted", /coalesce\("quotations"\."status", 'draft'\) = \$1$/, ["accepted"]],
    ["expired", /in \('draft', 'sent'\) and "quotations"\."valid_until" < \$1/, ["2026-10-09"]],
  ] as const)("status %s", (status, pattern, params) => {
    const query = dialect.sqlToQuery(quoteStatusCondition(status, "2026-10-09"));
    expect(query.sql).toMatch(pattern);
    expect(query.params).toEqual(params);
  });

  it("reads rows from postgres-js and node-postgres results", () => {
    expect(rowsOf([{ a: 1 }])).toEqual([{ a: 1 }]);
    expect(rowsOf({ rows: [{ a: 2 }] })).toEqual([{ a: 2 }]);
    expect(rowsOf(null)).toEqual([]);
  });
});

describe("resolveToday", () => {
  it("passes a valid date through", async () => {
    await expect(resolveToday("2026-10-09")).resolves.toBe("2026-10-09");
    expect(getSettings).not.toHaveBeenCalled();
  });

  it("falls back to today in the configured timezone", async () => {
    (getSettings as jest.Mock).mockResolvedValue({ region: { timezone: "Asia/Taipei" } });
    await expect(resolveToday("garbage")).resolves.toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(getSettings).toHaveBeenCalled();
  });
});

describe("getQuoteById", () => {
  it.each(["abc", "1.5", -1, 0, 2_147_483_648, "99999999999", null])(
    "returns null for invalid id %p without querying",
    async (id) => {
      await expect(getQuoteById(id)).resolves.toBeNull();
      expect(findFirst).not.toHaveBeenCalled();
    }
  );

  it("returns null when the quote does not exist", async () => {
    findFirst.mockResolvedValueOnce(undefined);
    await expect(getQuoteById("12")).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it("loads customer, ordered items and newest events", async () => {
    findFirst.mockResolvedValueOnce({ id: 12 });
    await expect(getQuoteById(12)).resolves.toEqual({ id: 12 });
    const config = findFirst.mock.calls[0][0];
    expect(config.with.customer).toBe(true);
    expect(config.with.items.orderBy).toHaveLength(2);
    expect(config.with.events.limit).toBe(50);
  });
});
