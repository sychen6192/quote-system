// Quote-number pattern help for the Settings page (pure, client-safe).
import {
  renderQuoteNumber,
  validateQuoteNumberPattern,
  type QuoteNumberPatternError,
} from "@/lib/quote-number";

export type PatternToken = "{YYYY}" | "{YY}" | "{ROC}" | "{MM}" | "{DD}" | "{SEQ:3}";

export const PATTERN_TOKENS: readonly PatternToken[] = [
  "{YYYY}",
  "{YY}",
  "{ROC}",
  "{MM}",
  "{DD}",
  "{SEQ:3}",
];

/** i18n key suffix for each token's explanation. */
export const TOKEN_KEYS: Record<PatternToken, string> = {
  "{YYYY}": "yyyy",
  "{YY}": "yy",
  "{ROC}": "roc",
  "{MM}": "mm",
  "{DD}": "dd",
  "{SEQ:3}": "seq",
};

/** What each token renders as on `today` (YYYY-MM-DD), sequence 1. */
export function tokenExample(token: PatternToken, today: string): string {
  if (token === "{SEQ:3}") return "001";
  try {
    return renderQuoteNumber(`${token}{SEQ:1}`, today, 1).slice(0, -1);
  } catch {
    return "";
  }
}

export type PatternPreview =
  | { ok: true; example: string }
  | { ok: false; error: QuoteNumberPatternError };

/** The first number the pattern produces today, or why it is invalid. */
export function previewPattern(pattern: string, today: string): PatternPreview {
  const validation = validateQuoteNumberPattern(pattern);
  if (!validation.ok) return validation;
  try {
    return { ok: true, example: renderQuoteNumber(pattern.trim(), today, 1) };
  } catch {
    return { ok: false, error: "UNKNOWN_TOKEN" };
  }
}

/**
 * Inserts `token` at the selection. A pattern holds one sequence token, so
 * inserting {SEQ:n} replaces an existing one instead of adding a second.
 */
export function insertToken(
  value: string,
  token: PatternToken,
  selectionStart: number | null,
  selectionEnd: number | null
): { value: string; caret: number } {
  let text = value;
  let start = selectionStart ?? text.length;
  let end = selectionEnd ?? start;
  if (start > end) [start, end] = [end, start];
  start = Math.max(0, Math.min(start, text.length));
  end = Math.max(start, Math.min(end, text.length));

  if (token.startsWith("{SEQ")) {
    const re = /\{SEQ(?::\d+)?\}/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) {
      const from = match.index;
      const to = from + match[0].length;
      // Leave a sequence token that the selection itself replaces.
      if (from >= start && to <= end) continue;
      text = text.slice(0, from) + text.slice(to);
      const removed = to - from;
      if (from < start) {
        start = Math.max(from, start - removed);
        end = Math.max(start, end - removed);
      } else if (from < end) {
        end = from;
      }
      re.lastIndex = from;
    }
  }

  const next = text.slice(0, start) + token + text.slice(end);
  return { value: next, caret: start + token.length };
}
