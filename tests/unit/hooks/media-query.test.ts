import { createMediaQueryStore, DESKTOP_MEDIA_QUERY } from "@/hooks/use-media-query";

function fakeHost(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  const queries: string[] = [];
  const host = {
    matchMedia(query: string) {
      queries.push(query);
      return {
        get matches() {
          return matches;
        },
        addEventListener: (_: string, cb: () => void) => listeners.add(cb),
        removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
      } as unknown as MediaQueryList;
    },
  };
  return {
    host,
    queries,
    listeners,
    set(next: boolean) {
      matches = next;
      listeners.forEach((cb) => cb());
    },
  };
}

describe("createMediaQueryStore", () => {
  it("is desktop at Tailwind xl", () => {
    expect(DESKTOP_MEDIA_QUERY).toBe("(min-width: 1280px)");
  });

  it("reads the live match and notifies subscribers", () => {
    const fake = fakeHost(false);
    const store = createMediaQueryStore(DESKTOP_MEDIA_QUERY, () => fake.host);
    const onChange = jest.fn();
    const unsubscribe = store.subscribe(onChange);

    expect(store.getSnapshot()).toBe(false);
    fake.set(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(true);
    expect(fake.queries.every((q) => q === DESKTOP_MEDIA_QUERY)).toBe(true);

    unsubscribe();
    expect(fake.listeners.size).toBe(0);
  });

  it("server snapshot is always false so hydration matches", () => {
    const fake = fakeHost(true);
    const store = createMediaQueryStore("(min-width: 1px)", () => fake.host);
    expect(store.getServerSnapshot()).toBe(false);
  });

  it("is inert without a window", () => {
    const store = createMediaQueryStore("(min-width: 1px)", () => undefined);
    expect(store.getSnapshot()).toBe(false);
    expect(() => store.subscribe(() => {})()).not.toThrow();
  });
});
