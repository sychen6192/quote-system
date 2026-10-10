"use client";

import { toast } from "sonner";

/**
 * A Server Action answered UNAUTHORIZED, or threw because the proxy rejected
 * it with 401: the session has expired. Reloading lets the proxy redirect to
 * the sign-in page (with ?next= back here).
 */
export function reloadForSignIn(message: string): void {
  toast.error(message);
  window.setTimeout(() => window.location.reload(), 1200);
}
