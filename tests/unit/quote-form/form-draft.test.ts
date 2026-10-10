import {
  createDraftStatusStore,
  draftDiffers,
  draftFingerprint,
  pruneDrafts,
  readDraft,
  removeDraft,
  writeDraft,
  type DraftStorage,
} from "@/hooks/use-form-draft";

class MemoryStorage implements DraftStorage {
  map = new Map<string, string>();
  quota = Infinity;
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (value.length > this.quota) {
      throw new DOMException("quota", "QuotaExceededError");
    }
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

describe("draft storage", () => {
  it("round-trips a draft", () => {
    const storage = new MemoryStorage();
    expect(writeDraft(storage, "k", { a: 1 }, 123)).toBe(true);
    expect(readDraft(storage, "k")).toEqual({ version: 1, savedAt: 123, values: { a: 1 } });
  });

  it("reports quota errors instead of throwing", () => {
    const storage = new MemoryStorage();
    storage.quota = 5;
    expect(writeDraft(storage, "k", { a: "long value" }, 1)).toBe(false);
    expect(readDraft(storage, "k")).toBeNull();
  });

  it("survives missing or throwing storage", () => {
    expect(writeDraft(null, "k", {}, 1)).toBe(false);
    expect(readDraft(null, "k")).toBeNull();
    const broken: DraftStorage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(readDraft(broken, "k")).toBeNull();
    expect(writeDraft(broken, "k", {}, 1)).toBe(false);
    expect(() => removeDraft(broken, "k")).not.toThrow();
    expect(() => pruneDrafts(broken, "p", "k")).not.toThrow();
  });

  it("ignores corrupt or foreign values", () => {
    const storage = new MemoryStorage();
    storage.setItem("a", "{not json");
    storage.setItem("b", JSON.stringify({ version: 99, savedAt: 1, values: {} }));
    storage.setItem("c", JSON.stringify({ version: 1, savedAt: "x", values: {} }));
    storage.setItem("d", JSON.stringify({ version: 1, savedAt: 1, values: null }));
    for (const key of ["a", "b", "c", "d", "missing"]) {
      expect(readDraft(storage, key)).toBeNull();
    }
  });

  it("prunes other versions of the same record only", () => {
    const storage = new MemoryStorage();
    for (const key of [
      "qs:draft:edit:7:100",
      "qs:draft:edit:7:200",
      "qs:draft:edit:70:100",
      "qs:draft:new",
    ]) {
      storage.setItem(key, "{}");
    }
    pruneDrafts(storage, "qs:draft:edit:7:", "qs:draft:edit:7:200");
    expect([...storage.map.keys()].sort()).toEqual(
      ["qs:draft:edit:7:200", "qs:draft:edit:70:100", "qs:draft:new"].sort()
    );
  });
});

describe("draftFingerprint", () => {
  it("ignores key order, number-vs-string inputs, whitespace and empty fields", () => {
    const a = { b: 1, a: " x ", items: [{ quantity: 2, description: "" }], notes: undefined };
    const b = { a: "x", items: [{ quantity: "2" }], b: "1", notes: "" };
    expect(draftFingerprint(a)).toBe(draftFingerprint(b));
    expect(draftDiffers(a, b)).toBe(false);
  });

  it("notices real changes", () => {
    expect(draftDiffers({ items: [{ q: 1 }] }, { items: [{ q: 1 }, { q: 1 }] })).toBe(true);
    expect(draftDiffers({ isTaxable: true }, { isTaxable: false })).toBe(true);
    expect(draftDiffers({ a: "x" }, { a: "y" })).toBe(true);
  });
});

describe("createDraftStatusStore", () => {
  it("notifies only on change", () => {
    const store = createDraftStatusStore();
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);
    expect(store.get()).toEqual({ status: "idle", savedAt: null });
    store.set({ status: "pending", savedAt: null });
    store.set({ status: "pending", savedAt: null });
    store.set({ status: "saved", savedAt: 5 });
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.set({ status: "error", savedAt: null });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.get().status).toBe("error");
  });
});
