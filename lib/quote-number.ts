// Configurable quote numbering (spec §5).
//
// Pattern tokens: {YYYY} {YY} {ROC} (民國年 = year − 1911) {MM} {DD} and
// exactly one {SEQ} / {SEQ:n} (zero-padded to n digits, never truncated).
// The date always comes from the quote's issuedDate (YYYY-MM-DD, already in
// the business timezone), never from the server clock.
//
// Render/parse helpers are pure and client-safe (the Settings page previews
// patterns); allocateQuoteNumber needs a drizzle transaction.
import { sql, type SQL } from "drizzle-orm";

export const DEFAULT_QUOTE_NUMBER_PATTERN = "QT-{YYYY}{MM}{DD}-{SEQ:3}";
export const MAX_PATTERN_LENGTH = 64;
const MAX_SEQ_PAD = 9;
const MAX_ALLOCATION_ATTEMPTS = 20;

const TOKEN_RE = /\{([A-Z]+)(?::(\d+))?\}/g;
const DATE_TOKENS = new Set(["YYYY", "YY", "ROC", "MM", "DD"]);

export type QuoteNumberPatternError =
  | "EMPTY"
  | "TOO_LONG"
  | "NO_SEQ"
  | "MULTIPLE_SEQ"
  | "UNKNOWN_TOKEN"
  | "BAD_SEQ_PAD"
  | "STRAY_BRACE";

export type QuoteNumberPatternValidation =
  | { ok: true }
  | { ok: false; error: QuoteNumberPatternError };

export function validateQuoteNumberPattern(
  pattern: string
): QuoteNumberPatternValidation {
  if (typeof pattern !== "string" || pattern.trim() === "") {
    return { ok: false, error: "EMPTY" };
  }
  if (pattern.length > MAX_PATTERN_LENGTH) return { ok: false, error: "TOO_LONG" };

  let seqCount = 0;
  for (const match of pattern.matchAll(TOKEN_RE)) {
    const [, name, pad] = match;
    if (name === "SEQ") {
      seqCount++;
      if (pad !== undefined) {
        const n = Number(pad);
        if (!Number.isInteger(n) || n < 1 || n > MAX_SEQ_PAD) {
          return { ok: false, error: "BAD_SEQ_PAD" };
        }
      }
    } else if (!DATE_TOKENS.has(name) || pad !== undefined) {
      return { ok: false, error: "UNKNOWN_TOKEN" };
    }
  }
  if (/[{}]/.test(pattern.replace(TOKEN_RE, ""))) {
    return { ok: false, error: "STRAY_BRACE" };
  }
  if (seqCount === 0) return { ok: false, error: "NO_SEQ" };
  if (seqCount > 1) return { ok: false, error: "MULTIPLE_SEQ" };
  return { ok: true };
}

function dateParts(issuedDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(issuedDate);
  if (!match) throw new Error(`Invalid issuedDate: ${issuedDate}`);
  const [, yyyy, mm, dd] = match;
  return {
    YYYY: yyyy,
    YY: yyyy.slice(2),
    ROC: String(Number(yyyy) - 1911),
    MM: mm,
    DD: dd,
  } as Record<string, string>;
}

export type QuoteNumberScope = {
  /** rendered text before the sequence number */
  prefix: string;
  /** rendered text after the sequence number */
  suffix: string;
  /** counter key: the pattern rendered without its SEQ token */
  scope: string;
  /** zero-pad width of the sequence (1 = none) */
  pad: number;
};

/** Throws on an invalid pattern or date; validate user input first. */
export function quoteNumberScope(
  pattern: string,
  issuedDate: string
): QuoteNumberScope {
  const validation = validateQuoteNumberPattern(pattern);
  if (!validation.ok) {
    throw new Error(`Invalid quote number pattern (${validation.error})`);
  }
  const parts = dateParts(issuedDate);
  let prefix = "";
  let suffix = "";
  let pad = 1;
  let seen = false;
  let last = 0;
  for (const match of pattern.matchAll(TOKEN_RE)) {
    const [token, name, padText] = match;
    const start = match.index ?? 0;
    const literal = pattern.slice(last, start);
    last = start + token.length;
    if (name === "SEQ") {
      prefix += literal;
      pad = padText ? Number(padText) : 1;
      seen = true;
    } else if (seen) {
      suffix += literal + parts[name];
    } else {
      prefix += literal + parts[name];
    }
  }
  suffix += pattern.slice(last);
  return { prefix, suffix, scope: prefix + suffix, pad };
}

export function formatQuoteNumber(scope: QuoteNumberScope, seq: number): string {
  return `${scope.prefix}${String(seq).padStart(scope.pad, "0")}${scope.suffix}`;
}

export function renderQuoteNumber(
  pattern: string,
  issuedDate: string,
  seq: number
): string {
  return formatQuoteNumber(quoteNumberScope(pattern, issuedDate), seq);
}

/** Anything drizzle can run raw SQL on: the db or a transaction. */
export type SqlExecutor = { execute: (query: SQL) => PromiseLike<unknown> };

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const rows = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

function codePointLength(text: string): number {
  return [...text].length;
}

async function nextCounterValue(
  tx: SqlExecutor,
  scope: QuoteNumberScope
): Promise<number> {
  const bumped = rowsOf(
    await tx.execute(sql`
      UPDATE quote_counters SET value = value + 1
      WHERE scope = ${scope.scope}
      RETURNING value`)
  );
  if (bumped.length > 0) return Number(bumped[0].value);

  // First number in this scope: continue after any existing (legacy or
  // manually entered) numbers. Two concurrent first inserts serialise on the
  // primary key and the loser falls into DO UPDATE, so both get a value.
  const prefixLength = codePointLength(scope.prefix);
  const suffixLength = codePointLength(scope.suffix);
  const inserted = rowsOf(
    await tx.execute(sql`
      INSERT INTO quote_counters (scope, value)
      VALUES (
        ${scope.scope},
        (
          SELECT COALESCE(MAX(CAST(seq AS integer)), 0) + 1
          FROM (
            SELECT substr(
              quotation_number,
              ${prefixLength + 1}::integer,
              char_length(quotation_number) - ${prefixLength + suffixLength}::integer
            ) AS seq
            FROM quotations
            WHERE char_length(quotation_number) > ${prefixLength + suffixLength}::integer
              AND left(quotation_number, ${prefixLength}::integer) = ${scope.prefix}
              AND right(quotation_number, ${suffixLength}::integer) = ${scope.suffix}
          ) AS existing
          WHERE seq ~ '^[0-9]{1,9}$'
        )
      )
      ON CONFLICT (scope) DO UPDATE SET value = quote_counters.value + 1
      RETURNING value`)
  );
  if (inserted.length === 0) throw new Error("quote counter returned no row");
  return Number(inserted[0].value);
}

async function numberExists(tx: SqlExecutor, quotationNumber: string) {
  const rows = rowsOf(
    await tx.execute(
      sql`SELECT 1 AS found FROM quotations WHERE quotation_number = ${quotationNumber} LIMIT 1`
    )
  );
  return rows.length > 0;
}

/**
 * Allocates the next free quote number for `pattern` on `issuedDate`.
 * Call inside the transaction that inserts the quote, so the counter bump
 * rolls back with it.
 */
export async function allocateQuoteNumber(
  tx: SqlExecutor,
  { pattern, issuedDate }: { pattern: string; issuedDate: string }
): Promise<string> {
  const scope = quoteNumberScope(pattern, issuedDate);
  for (let attempt = 0; attempt < MAX_ALLOCATION_ATTEMPTS; attempt++) {
    const candidate = formatQuoteNumber(scope, await nextCounterValue(tx, scope));
    if (!(await numberExists(tx, candidate))) return candidate;
  }
  throw new Error(
    `Could not allocate a free quote number in scope "${scope.scope}"`
  );
}
