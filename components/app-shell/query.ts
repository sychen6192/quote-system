// URL query helpers for the list pages (search, filters, sort, pagination).
// Pure: used by server pages (links) and client toolbars (router.replace).

export type QueryValue = string | number | null | undefined;
export type QueryInput = Record<string, string | string[] | undefined>;

/** First value of a searchParams entry, trimmed; "" when absent. */
export function firstParam(value: string | string[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" ? v.trim() : "";
}

/**
 * `base` with `patch` applied: null/undefined/"" removes a key. Unless the
 * patch sets `page` itself, any change resets to page 1 (a new filter starts
 * at the top). Keys are emitted in a stable order so equal states give equal
 * URLs.
 */
export function mergeQuery(
  base: URLSearchParams | Record<string, QueryValue>,
  patch: Record<string, QueryValue> = {}
): URLSearchParams {
  const entries: [string, string][] =
    base instanceof URLSearchParams
      ? [...base.entries()]
      : Object.entries(base).flatMap(([k, v]) =>
          v === null || v === undefined || v === "" ? [] : [[k, String(v)] as [string, string]]
        );
  const next = new Map<string, string>(entries);
  const touchesPage = Object.prototype.hasOwnProperty.call(patch, "page");
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  if (!touchesPage && Object.keys(patch).length > 0) next.delete("page");
  if (next.get("page") === "1") next.delete("page");
  return new URLSearchParams([...next.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/** "/quotes" + "?a=1" (no "?" when empty). */
export function withQuery(pathname: string, params: URLSearchParams): string {
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
