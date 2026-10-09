// PLACEHOLDER — replaced by the auth implementation (Wave A1).
// Contract: resolves when the request is authenticated (or auth is disabled
// because APP_PASSWORD is unset); otherwise throws an Error whose message is
// "UNAUTHENTICATED". Call it first thing in every Server Action and in every
// Route Handler that returns private data.
export async function assertAuthenticated(): Promise<void> {}

export function isUnauthenticatedError(error: unknown): boolean {
  return error instanceof Error && error.message === "UNAUTHENTICATED";
}
