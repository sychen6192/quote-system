import { createDraftCarrier, expectedVersionArg } from "@/components/quote-form/conflict";
import { quoteDraftKey, quoteVersion } from "@/components/quote-form/form-model";
import {
  DRAFT_VERSION,
  draftToOffer,
  pruneDrafts,
  readDraft,
  writeDraft,
  type DraftStorage,
  type StoredDraft,
} from "@/hooks/use-form-draft";

class MemoryStorage implements DraftStorage {
  map = new Map<string, string>();
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
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

const draft = (savedAt: number, title: string): StoredDraft<{ title: string }> => ({
  version: DRAFT_VERSION,
  savedAt,
  values: { title },
});

describe("quoteVersion", () => {
  it("is updatedAt in epoch ms, the way updateQuote compares it", () => {
    const at = new Date("2026-10-10T08:30:00.123Z");
    expect(quoteVersion(at)).toBe(at.getTime());
    expect(quoteVersion(at.toISOString())).toBe(at.getTime());
    expect(quoteVersion(at.getTime())).toBe(at.getTime());
  });

  it("is null for a quote never edited (and for unreadable values)", () => {
    expect(quoteVersion(null)).toBeNull();
    expect(quoteVersion(undefined)).toBeNull();
    expect(quoteVersion("not a date")).toBeNull();
    expect(quoteVersion(new Date(NaN))).toBeNull();
  });
});

describe("expectedVersionArg", () => {
  it("sends the loaded version on a normal save", () => {
    expect(expectedVersionArg(1760085000123, { overwrite: false })).toBe(1760085000123);
    // Never edited since creation: still checked (null), not skipped.
    expect(expectedVersionArg(null, { overwrite: false })).toBeNull();
  });

  it("sends nothing for Save anyway, so the server skips the check", () => {
    expect(expectedVersionArg(1760085000123, { overwrite: true })).toBeUndefined();
    expect(expectedVersionArg(null, { overwrite: true })).toBeUndefined();
  });
});

describe("createDraftCarrier", () => {
  it("hands the edits to the editor of the newer version only", () => {
    const carrier = createDraftCarrier<{ title: string }>();
    const edits = draft(5, "mine");
    carrier.hold({ quoteId: 7, fromVersion: 100, draft: edits });
    // The editor that parked them (same version) does not take them back…
    expect(carrier.peek(7, 100)).toBeNull();
    // …nor does another quote's editor.
    expect(carrier.peek(8, 200)).toBeNull();
    expect(carrier.peek(7, 200)).toBe(edits);
    carrier.release(edits);
    expect(carrier.peek(7, 200)).toBeNull();
  });

  it("works for a quote that was never edited before (version null)", () => {
    const carrier = createDraftCarrier<{ title: string }>();
    const edits = draft(5, "mine");
    carrier.hold({ quoteId: 7, fromVersion: null, draft: edits });
    expect(carrier.peek(7, null)).toBeNull();
    expect(carrier.peek(7, 300)).toBe(edits);
  });

  it("release() of an older hand-over keeps a newer one", () => {
    const carrier = createDraftCarrier<{ title: string }>();
    const first = draft(1, "first");
    const second = draft(2, "second");
    carrier.hold({ quoteId: 7, fromVersion: 100, draft: first });
    carrier.hold({ quoteId: 7, fromVersion: 100, draft: second });
    carrier.release(first);
    expect(carrier.peek(7, 200)).toBe(second);
  });
});

describe("draftToOffer", () => {
  it("offers the stored draft, else the seed, else nothing", () => {
    const stored = draft(10, "stored");
    const seed = draft(20, "seed");
    expect(draftToOffer(null, null)).toBeNull();
    expect(draftToOffer(stored, null)).toBe(stored);
    expect(draftToOffer(null, seed)).toBe(seed);
  });

  it("prefers whichever is newer", () => {
    expect(draftToOffer(draft(10, "stored"), draft(20, "seed"))?.values.title).toBe("seed");
    expect(draftToOffer(draft(30, "stored"), draft(20, "seed"))?.values.title).toBe("stored");
  });
});

describe("Reload latest keeps the user's edits", () => {
  it("survives the old version's draft being pruned by the new editor", () => {
    const storage = new MemoryStorage();
    const carrier = createDraftCarrier<{ title: string }>();
    const oldKey = quoteDraftKey({ id: 7, updatedAt: 100 });
    const newKey = quoteDraftKey({ id: 7, updatedAt: 200 });

    // The editor at version 100 autosaved, hit CONFLICT, and the user chose Reload latest.
    writeDraft(storage, oldKey, { title: "mine" }, 5);
    carrier.hold({ quoteId: 7, fromVersion: 100, draft: draft(6, "mine") });

    // The editor for version 200 mounts: prunes old versions' drafts…
    pruneDrafts(storage, "qs:draft:edit:7:", newKey);
    expect(readDraft(storage, oldKey)).toBeNull();
    // …offers the carried edits and stores them under its own key (what the hook does).
    const seed = carrier.peek(7, 200);
    const offered = draftToOffer(readDraft<{ title: string }>(storage, newKey), seed);
    expect(offered?.values).toEqual({ title: "mine" });
    writeDraft(storage, newKey, offered!.values, offered!.savedAt);
    carrier.release(seed!);

    // A reload of the page still finds them.
    expect(readDraft(storage, newKey)?.values).toEqual({ title: "mine" });
    expect(carrier.peek(7, 200)).toBeNull();
  });
});
