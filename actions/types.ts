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
