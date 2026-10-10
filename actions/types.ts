// Result contract shared by the server actions. `message` is a developer-
// facing English summary for logs; the UI picks its text from `code` (and
// from the Validation-namespace keys in `fieldErrors`). Raw DB / Resend
// error text never goes into a result.
import { assertAuthenticated, isUnauthenticatedError } from "@/lib/auth/guard";

export type ActionFailure =
  | {
      success: false;
      code: "VALIDATION";
      /** dotted paths ("items.0.quantity") → Validation message keys */
      fieldErrors: Record<string, string[] | undefined>;
    }
  | { success: false; code: "NOT_FOUND"; message: string }
  /** The record changed since the caller loaded it: see {@link ConflictFailure}. */
  | { success: false; code: "CONFLICT"; message: string }
  | { success: false; code: "INTERNAL"; message: string }
  | { success: false; code: "UNAUTHORIZED"; message: string }
  | {
      success: false;
      code: "RATE_LIMITED";
      message: string;
      retryAfterMs: number;
    };

export type ActionResult = { success: true; id?: number } | ActionFailure;

export type ActionErrorCode = ActionFailure["code"];

/**
 * The version of a quote an editor was loaded with: the quote's `updatedAt`
 * exactly as the page read it (a Date, its ISO string or epoch ms), or null
 * for a quote never edited since it was created. Anything else is rejected
 * as VALIDATION `fieldErrors.expectedUpdatedAt`.
 */
export type QuoteVersion = Date | string | number | null;

/**
 * Edit-conflict contract of `updateQuote(id, data, expectedUpdatedAt?)`:
 *
 * - Pass the {@link QuoteVersion} the editor was loaded with as the third
 *   argument. If the quote was saved (or its status changed) since, by
 *   another tab, device or person, nothing is written and the result is this
 *   failure.
 * - Offer the user two ways out:
 *   - "Reload latest": load the quote again (their unsaved input is lost
 *     unless kept elsewhere, e.g. the local draft), then edit and save with
 *     the new `updatedAt`.
 *   - "Save anyway": call `updateQuote(id, data)` again without the third
 *     argument. That skips the check and overwrites the other change.
 * - Leaving the version out always skips the check (older clients, scripts).
 *
 * `message` is for logs only; pick the UI text from `code`. Type-only for
 * client components: this module imports server code, so narrow with
 * `result.code === "CONFLICT"` instead of importing a runtime helper.
 */
export type ConflictFailure = Extract<ActionFailure, { code: "CONFLICT" }>;

export const unauthorized = (): ActionFailure => ({
  success: false,
  code: "UNAUTHORIZED",
  message: "Sign in required",
});

export const rateLimited = (retryAfterMs: number): ActionFailure => ({
  success: false,
  code: "RATE_LIMITED",
  message: "Too many requests",
  retryAfterMs,
});

export const notFound = (what: string): ActionFailure => ({
  success: false,
  code: "NOT_FOUND",
  message: `${what} was not found`,
});

/** See {@link ConflictFailure}. */
export const conflict = (message: string): ConflictFailure => ({
  success: false,
  code: "CONFLICT",
  message,
});

export const internalError = (message: string): ActionFailure => ({
  success: false,
  code: "INTERNAL",
  message,
});

export const validationError = (
  fieldErrors: Record<string, string[] | undefined>
): ActionFailure => ({ success: false, code: "VALIDATION", fieldErrors });

/**
 * First line of every server action: null when the caller may proceed,
 * otherwise the UNAUTHORIZED result to return as-is.
 */
export async function requireAuth(): Promise<ActionFailure | null> {
  try {
    await assertAuthenticated();
    return null;
  } catch (error) {
    if (isUnauthenticatedError(error)) return unauthorized();
    throw error;
  }
}

/** Postgres SQLSTATE of an error, looking through drizzle's wrappers. */
export function pgErrorCode(error: unknown): string | undefined {
  for (let e: unknown = error, depth = 0; e && depth < 5; depth++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Constraint name of a Postgres error, looking through wrappers. */
export function pgConstraintName(error: unknown): string | undefined {
  for (let e: unknown = error, depth = 0; e && depth < 5; depth++) {
    const name =
      (e as { constraint_name?: unknown }).constraint_name ??
      (e as { constraint?: unknown }).constraint;
    if (typeof name === "string") return name;
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}
