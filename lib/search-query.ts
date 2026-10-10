// Free-text search input (list ?q=, customer directory, comboboxes, the
// "View quotes" customer link). Postgres rejects text parameters containing
// NUL ("invalid byte sequence for encoding UTF8: 0x00"), so a bookmarked
// ?q=%00 would crash the page; other control characters never match anything
// useful. Client-safe.

export const MAX_SEARCH_QUERY_LENGTH = 100;

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/** First string of a search-param value (`?q=a&q=b` → "a"), else "". */
export function firstParam(value: unknown): string {
  if (Array.isArray(value)) return firstParam(value[0]);
  return typeof value === "string" ? value : "";
}

/** Control characters removed, trimmed, capped at `max` characters. */
export function normalizeSearchQuery(raw: unknown, max = MAX_SEARCH_QUERY_LENGTH): string {
  return firstParam(raw).replace(CONTROL_CHARS, "").trim().slice(0, max);
}
