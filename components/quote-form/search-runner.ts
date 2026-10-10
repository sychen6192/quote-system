// The request side of AsyncCombobox, framework-free so it is unit-tested
// directly: a per-term cache, stale answers dropped, and nothing reported
// once the combobox is gone.
import type { SearchResult } from "@/actions/search";

export type SearchUpdate<T> =
  | { status: "done"; term: string; results: T[] }
  | { status: "error" }
  | { status: "offline" };

export type SearchRunnerOptions<T> = {
  search: (term: string) => Promise<SearchResult<T>>;
  onUpdate: (update: SearchUpdate<T>) => void;
  /** UNAUTHORIZED, or the request threw while online (the proxy's 401). */
  onSessionError: () => void;
  isOffline?: () => boolean;
};

export type SearchRunner<T> = {
  /** Swap in the latest callbacks (props change between renders). */
  setOptions(options: SearchRunnerOptions<T>): void;
  cached(term: string): T[] | undefined;
  run(term: string): Promise<void>;
  /** Drop whatever is in flight: a newer term, a pick, or the form is being saved. */
  cancel(): void;
  /** Mounted (again): answers are reported. */
  attach(): void;
  /**
   * Unmounted: in-flight answers are dropped. A navigation (e.g. saving the
   * quote) aborts the request and rejects it; that is not an expired session.
   */
  detach(): void;
};

export function browserIsOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function createSearchRunner<T>(initial: SearchRunnerOptions<T>): SearchRunner<T> {
  let options = initial;
  let ticket = 0;
  let attached = true;
  const cache = new Map<string, T[]>();
  const isCurrent = (mine: number) => attached && mine === ticket;

  return {
    setOptions(next) {
      options = next;
    },
    cached(term) {
      return cache.get(term.toLowerCase());
    },
    async run(term) {
      const key = term.toLowerCase();
      const hit = cache.get(key);
      const mine = ++ticket;
      if (hit) {
        options.onUpdate({ status: "done", term, results: hit });
        return;
      }
      try {
        const result = await options.search(term);
        if (!isCurrent(mine)) return;
        if (result.success) {
          cache.set(key, result.data);
          options.onUpdate({ status: "done", term, results: result.data });
        } else if (result.code === "UNAUTHORIZED") {
          options.onSessionError();
        } else {
          options.onUpdate({ status: "error" });
        }
      } catch {
        if (!isCurrent(mine)) return;
        if ((options.isOffline ?? browserIsOffline)()) options.onUpdate({ status: "offline" });
        else options.onSessionError();
      }
    },
    cancel() {
      ticket++;
    },
    attach() {
      attached = true;
    },
    detach() {
      attached = false;
      ticket++;
    },
  };
}
