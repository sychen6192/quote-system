import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import {
  DEFAULT_QUOTE_NUMBER_PATTERN,
  allocateQuoteNumber,
  parseQuoteNumberSeq,
  quoteNumberScope,
  renderQuoteNumber,
  validateQuoteNumberPattern,
} from "@/lib/quote-number";

describe("validateQuoteNumberPattern", () => {
  it.each([
    DEFAULT_QUOTE_NUMBER_PATTERN,
    "{SEQ}",
    "Q{SEQ:5}",
    "{ROC}{MM}-{SEQ:4}",
    "報價-{YY}{MM}{DD}{SEQ:2}",
    "{SEQ:3}-{YYYY}",
  ])("accepts %s", (pattern) => {
    expect(validateQuoteNumberPattern(pattern)).toEqual({ ok: true });
  });

  it.each([
    ["", "EMPTY"],
    ["   ", "EMPTY"],
    ["QT-{YYYY}", "NO_SEQ"],
    ["{SEQ}-{SEQ:3}", "MULTIPLE_SEQ"],
    ["{SEQ}{HH}", "UNKNOWN_TOKEN"],
    ["{seq}", "STRAY_BRACE"],
    ["{YYYY:2}{SEQ}", "UNKNOWN_TOKEN"],
    ["{SEQ:0}", "BAD_SEQ_PAD"],
    ["{SEQ:10}", "BAD_SEQ_PAD"],
    ["QT-{SEQ}}", "STRAY_BRACE"],
    ["QT-{{SEQ}", "STRAY_BRACE"],
    [`${"X".repeat(70)}{SEQ}`, "TOO_LONG"],
  ])("rejects %p (%s)", (pattern, error) => {
    expect(validateQuoteNumberPattern(pattern)).toEqual({ ok: false, error });
  });
});

describe("renderQuoteNumber", () => {
  it.each([
    [DEFAULT_QUOTE_NUMBER_PATTERN, "2026-10-09", 1, "QT-20261009-001"],
    [DEFAULT_QUOTE_NUMBER_PATTERN, "2026-10-09", 1000, "QT-20261009-1000"],
    ["{ROC}{MM}{DD}-{SEQ:3}", "2026-10-09", 7, "1151009-007"],
    ["{ROC}-{SEQ}", "1912-01-01", 12, "1-12"],
    ["Q{YY}{SEQ:4}", "2026-01-31", 42, "Q260042"],
    ["{SEQ:2}/{YYYY}", "2026-12-31", 3, "03/2026"],
    ["報價{YYYY}{MM}-{SEQ:3}", "2026-03-05", 5, "報價202603-005"],
    ["{SEQ}", "2026-10-09", 99, "99"],
  ])("%s on %s #%i → %s", (pattern, date, seq, expected) => {
    expect(renderQuoteNumber(pattern, date, seq)).toBe(expected);
  });

  it("throws on an invalid pattern or date", () => {
    expect(() => renderQuoteNumber("QT", "2026-10-09", 1)).toThrow(/NO_SEQ/);
    expect(() => renderQuoteNumber(DEFAULT_QUOTE_NUMBER_PATTERN, "20261009", 1)).toThrow();
  });
});

describe("quoteNumberScope / parseQuoteNumberSeq", () => {
  it("splits the rendered pattern around SEQ", () => {
    expect(quoteNumberScope(DEFAULT_QUOTE_NUMBER_PATTERN, "2026-10-09")).toEqual({
      prefix: "QT-20261009-",
      suffix: "",
      scope: "QT-20261009-",
      pad: 3,
    });
    expect(quoteNumberScope("{SEQ:2}/{YYYY}", "2026-12-31")).toEqual({
      prefix: "",
      suffix: "/2026",
      scope: "/2026",
      pad: 2,
    });
  });

  it("parses the sequence back out", () => {
    const scope = quoteNumberScope(DEFAULT_QUOTE_NUMBER_PATTERN, "2026-10-09");
    expect(parseQuoteNumberSeq("QT-20261009-007", scope)).toBe(7);
    expect(parseQuoteNumberSeq("QT-20261009-1000", scope)).toBe(1000);
    expect(parseQuoteNumberSeq("QT-20261008-007", scope)).toBeNull();
    expect(parseQuoteNumberSeq("QT-20261009-", scope)).toBeNull();
    expect(parseQuoteNumberSeq("QT-20261009-12a", scope)).toBeNull();

    const suffixed = quoteNumberScope("{SEQ:2}/{YYYY}", "2026-12-31");
    expect(parseQuoteNumberSeq("05/2026", suffixed)).toBe(5);
    expect(parseQuoteNumberSeq("05/2025", suffixed)).toBeNull();
  });
});

describe("allocateQuoteNumber", () => {
  const dialect = new PgDialect();
  const text = (query: SQL) => dialect.sqlToQuery(query).sql.replace(/\s+/g, " ").trim();

  function fakeTx(responses: unknown[][]) {
    const queries: { sql: string; params: unknown[] }[] = [];
    return {
      queries,
      tx: {
        execute: jest.fn(async (query: SQL) => {
          const compiled = dialect.sqlToQuery(query);
          queries.push({ sql: text(query), params: compiled.params });
          return responses.shift() ?? [];
        }),
      },
    };
  }

  it("bumps an existing counter", async () => {
    const { tx, queries } = fakeTx([[{ value: 4 }], []]);
    await expect(
      allocateQuoteNumber(tx, { pattern: DEFAULT_QUOTE_NUMBER_PATTERN, issuedDate: "2026-10-09" })
    ).resolves.toBe("QT-20261009-004");
    expect(queries[0].sql).toMatch(/^UPDATE quote_counters SET value = value \+ 1/);
    expect(queries[0].params).toEqual(["QT-20261009-"]);
    expect(queries[1].sql).toMatch(/SELECT 1 AS found FROM quotations/);
    expect(queries[1].params).toEqual(["QT-20261009-004"]);
  });

  it("seeds a new scope from existing numbers via INSERT … ON CONFLICT", async () => {
    // postgres-js returns numeric columns as strings
    const { tx, queries } = fakeTx([[], [{ value: "12" }], []]);
    await expect(
      allocateQuoteNumber(tx, { pattern: "{SEQ:2}/{YYYY}", issuedDate: "2026-12-31" })
    ).resolves.toBe("12/2026");
    expect(queries[1].sql).toMatch(/INSERT INTO quote_counters/);
    expect(queries[1].sql).toMatch(/ON CONFLICT \(scope\) DO UPDATE/);
    expect(queries[1].params).toEqual(
      expect.arrayContaining(["/2026", "", 0, 5])
    );
  });

  it("skips numbers that already exist (legacy / manual data)", async () => {
    const { tx } = fakeTx([[{ value: 1 }], [{ found: 1 }], [{ value: 2 }], [{ found: 1 }], [{ value: 3 }], []]);
    await expect(
      allocateQuoteNumber(tx, { pattern: DEFAULT_QUOTE_NUMBER_PATTERN, issuedDate: "2026-10-09" })
    ).resolves.toBe("QT-20261009-003");
  });

  it("gives up after 20 attempts", async () => {
    const responses: unknown[][] = [];
    for (let i = 1; i <= 20; i++) responses.push([{ value: i }], [{ found: 1 }]);
    const { tx } = fakeTx(responses);
    await expect(
      allocateQuoteNumber(tx, { pattern: DEFAULT_QUOTE_NUMBER_PATTERN, issuedDate: "2026-10-09" })
    ).rejects.toThrow(/Could not allocate/);
    expect(tx.execute).toHaveBeenCalledTimes(40);
  });

  it("accepts node-postgres style { rows } results", async () => {
    const { tx } = fakeTx([{ rows: [{ value: 9 }] } as unknown as unknown[], { rows: [] } as unknown as unknown[]]);
    await expect(
      allocateQuoteNumber(tx, { pattern: "{SEQ}", issuedDate: "2026-10-09" })
    ).resolves.toBe("9");
  });

  it("rejects an invalid pattern before touching the database", async () => {
    const { tx } = fakeTx([]);
    await expect(
      allocateQuoteNumber(tx, { pattern: "QT-{YYYY}", issuedDate: "2026-10-09" })
    ).rejects.toThrow(/NO_SEQ/);
    expect(tx.execute).not.toHaveBeenCalled();
  });
});
