import type { SearchResult } from "@/actions/search";
import { createSearchRunner, type SearchUpdate } from "@/components/quote-form/search-runner";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(isOffline = () => false) {
  const pending: ReturnType<typeof deferred<SearchResult<string>>>[] = [];
  const search = jest.fn(() => {
    const d = deferred<SearchResult<string>>();
    pending.push(d);
    return d.promise;
  });
  const updates: SearchUpdate<string>[] = [];
  const onSessionError = jest.fn();
  const runner = createSearchRunner<string>({
    search,
    onUpdate: (update) => updates.push(update),
    onSessionError,
    isOffline,
  });
  return { runner, search, pending, updates, onSessionError };
}

describe("createSearchRunner", () => {
  it("reports results and caches them per term (case-insensitive)", async () => {
    const { runner, search, pending, updates } = setup();
    const run = runner.run("Abc");
    pending[0].resolve({ success: true, data: ["Abc Ltd"] });
    await run;
    expect(updates).toEqual([{ status: "done", term: "Abc", results: ["Abc Ltd"] }]);

    await runner.run("abc");
    expect(search).toHaveBeenCalledTimes(1);
    expect(runner.cached("ABC")).toEqual(["Abc Ltd"]);
  });

  // Saving navigates away while a search is still in flight: the aborted
  // request rejects after the combobox is gone. That is not an expired session.
  it("ignores a rejection that arrives after it was detached (unmounted)", async () => {
    const { runner, pending, updates, onSessionError } = setup();
    const run = runner.run("abc");
    runner.detach();
    pending[0].reject(new TypeError("Failed to fetch"));
    await run;
    expect(onSessionError).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it("ignores a rejection after cancel() (the form started saving)", async () => {
    const { runner, pending, onSessionError } = setup();
    const run = runner.run("abc");
    runner.cancel();
    pending[0].reject(new Error("aborted"));
    await run;
    expect(onSessionError).not.toHaveBeenCalled();
  });

  // The proxy answers a server action with an expired session with 401, which
  // makes the action throw: while mounted and online that still means "sign in".
  it("still reports a thrown request while mounted and online as a session error", async () => {
    const { runner, pending, onSessionError } = setup();
    const run = runner.run("abc");
    pending[0].reject(new Error("401"));
    await run;
    expect(onSessionError).toHaveBeenCalledTimes(1);
  });

  it("reports offline instead of a session error when the browser is offline", async () => {
    const { runner, pending, updates, onSessionError } = setup(() => true);
    const run = runner.run("abc");
    pending[0].reject(new TypeError("Failed to fetch"));
    await run;
    expect(onSessionError).not.toHaveBeenCalled();
    expect(updates).toEqual([{ status: "offline" }]);
  });

  it("reports UNAUTHORIZED results as a session error and other failures as errors", async () => {
    const { runner, pending, updates, onSessionError } = setup();
    const first = runner.run("a");
    pending[0].resolve({ success: false, code: "UNAUTHORIZED", message: "x" } as SearchResult<string>);
    await first;
    expect(onSessionError).toHaveBeenCalledTimes(1);
    const second = runner.run("b");
    pending[1].resolve({ success: false, code: "INTERNAL", message: "x" } as SearchResult<string>);
    await second;
    expect(updates).toEqual([{ status: "error" }]);
  });

  it("drops a stale answer once a newer term (even a cached one) has run", async () => {
    const { runner, pending, updates } = setup();
    const warm = runner.run("b");
    pending[0].resolve({ success: true, data: ["B"] });
    await warm;
    updates.length = 0;

    const slow = runner.run("a");
    await runner.run("b"); // cache hit
    pending[1].resolve({ success: true, data: ["A"] });
    await slow;
    expect(updates).toEqual([{ status: "done", term: "b", results: ["B"] }]);
  });

  it("reports again after being re-attached (StrictMode remount)", async () => {
    const { runner, pending, updates } = setup();
    runner.detach();
    runner.attach();
    const run = runner.run("abc");
    pending[0].resolve({ success: true, data: [] });
    await run;
    expect(updates).toEqual([{ status: "done", term: "abc", results: [] }]);
  });
});
