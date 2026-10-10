// Pure helpers behind the editor's "changed elsewhere" flow (optimistic
// concurrency, actions/update-quote.ts): what updateQuote is told about the
// version, and how unsaved edits survive "Reload latest".
import type { StoredDraft } from "@/hooks/use-form-draft";

/**
 * updateQuote's third argument: the version the editor loaded (the save is
 * refused with CONFLICT if the quote changed since), or nothing for "Save
 * anyway", which overwrites whatever is stored.
 */
export function expectedVersionArg(
  version: number | null | undefined,
  { overwrite }: { overwrite: boolean }
): number | null | undefined {
  return overwrite ? undefined : version;
}

export type HeldDraft<T> = {
  quoteId: number;
  /** The version the edits were made against. */
  fromVersion: number | null;
  draft: StoredDraft<T>;
};

export type DraftCarrier<T> = {
  /** "Reload latest": park the user's edits before the page refreshes. */
  hold(entry: HeldDraft<T>): void;
  /**
   * The edits parked for this quote, once an editor for another (newer)
   * version of it mounts; null for the editor that parked them.
   */
  peek(quoteId: number, version: number | null): StoredDraft<T> | null;
  /** The new editor has stored them as its own draft. */
  release(draft: StoredDraft<T>): void;
};

/**
 * Hands unsaved edits from the editor that hit a conflict to the one that
 * replaces it after the refresh. That one stores them under its own draft key
 * and offers "Restore draft", so reloading never loses what was typed (the
 * old version's draft key is pruned when the new version mounts).
 */
export function createDraftCarrier<T>(): DraftCarrier<T> {
  let held: HeldDraft<T> | null = null;
  return {
    hold(entry) {
      held = entry;
    },
    peek(quoteId, version) {
      return held && held.quoteId === quoteId && held.fromVersion !== version ? held.draft : null;
    },
    release(draft) {
      if (held?.draft === draft) held = null;
    },
  };
}
