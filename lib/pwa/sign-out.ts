// Sign-out on a shared device (PWA_LOGOUT_EVENT): besides the service
// worker's caches, the only private data the app keeps in the browser is the
// quote editor's autosave (customer details, prices). Pure, so it is
// testable with in-memory storages.

import { pruneDrafts, type DraftStorage } from "@/hooks/use-form-draft";
import { isLoginPath } from "./platform";

/** localStorage prefix of every quote draft (components/quote-form/form-model.ts quoteDraftKey). */
export const QUOTE_DRAFT_PREFIX = "qs:draft:";

/** sessionStorage: this tab started a sign-out; the login page finishes it. */
export const SIGN_OUT_PENDING_KEY = "qs:signing-out";

type SessionStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Removes every quote draft; other keys (theme, …) stay. */
export function clearQuoteDrafts(local: DraftStorage | null): void {
  pruneDrafts(local, QUOTE_DRAFT_PREFIX, "");
}

/** On PWA_LOGOUT_EVENT, before the browser leaves the page. */
export function beginSignOut(local: DraftStorage | null, session: SessionStore | null): void {
  clearQuoteDrafts(local);
  try {
    session?.setItem(SIGN_OUT_PENDING_KEY, "1");
  } catch {
    // Storage blocked: the drafts were cleared once, which covers most cases.
  }
}

/**
 * On every route change. An open editor writes its pending change back on
 * pagehide, after the logout event, so the login page this tab's sign-out
 * lands on clears the drafts again. Anywhere else the sign-out did not
 * happen (cancelled at the "leave page?" prompt). A login page reached
 * without it (the session expired) keeps the drafts.
 */
export function settleSignOut(pathname: string, local: DraftStorage | null, session: SessionStore | null): void {
  let pending = false;
  try {
    pending = session?.getItem(SIGN_OUT_PENDING_KEY) === "1";
    if (pending) session?.removeItem(SIGN_OUT_PENDING_KEY);
  } catch {
    return;
  }
  if (pending && isLoginPath(pathname)) clearQuoteDrafts(local);
}
