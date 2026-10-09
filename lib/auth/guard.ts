import { cookies } from "next/headers";
import { SESSION_COOKIE, authEnabled, verifySessionToken } from "./session";

const UNAUTHENTICATED = "UNAUTHENTICATED";

/**
 * Whether the current request may see private data: always true when
 * APP_PASSWORD is unset, otherwise only with a valid session cookie.
 */
export async function isAuthenticated(): Promise<boolean> {
  if (!authEnabled()) return true;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

/**
 * Defence in depth behind proxy.ts: Server Actions and Route Handlers are
 * public POST/GET endpoints, so call this first thing in every one that
 * reads or changes private data. Throws `Error("UNAUTHENTICATED")`.
 */
export async function assertAuthenticated(): Promise<void> {
  if (!(await isAuthenticated())) throw new Error(UNAUTHENTICATED);
}

export function isUnauthenticatedError(error: unknown): boolean {
  return error instanceof Error && error.message === UNAUTHENTICATED;
}
