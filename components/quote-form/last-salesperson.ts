// The salesperson of the last quote saved on this device. New quotes start
// with it when Settings has no default salesperson. A cookie rather than
// localStorage, so the server renders the form with it: no flash of an empty
// field, and the form does not count it as an unsaved change.
export const LAST_SALESPERSON_COOKIE = "qs_salesperson";

/** quoteFormSchema's limit for the salesperson. */
const MAX_LENGTH = 100;
const YEAR = 60 * 60 * 24 * 365;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

function usable(name: string): string {
  const value = name.trim();
  return value.length <= MAX_LENGTH && !CONTROL_CHARS.test(value) ? value : "";
}

/** A `document.cookie` assignment remembering `name` (forgetting it when blank). */
export function lastSalespersonCookie(name: string): string {
  const value = usable(name);
  return value
    ? `${LAST_SALESPERSON_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${YEAR}; samesite=lax`
    : `${LAST_SALESPERSON_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/** The remembered name from the cookie value as Next reads it (already decoded); "" if unusable. */
export function readLastSalesperson(value: string | undefined): string {
  return value ? usable(value) : "";
}
