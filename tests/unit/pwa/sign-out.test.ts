import { quoteDraftKey, quoteDraftPrefix } from "@/components/quote-form/form-model";
import {
  QUOTE_DRAFT_PREFIX,
  SIGN_OUT_PENDING_KEY,
  beginSignOut,
  clearQuoteDrafts,
  settleSignOut,
} from "@/lib/pwa/sign-out";

class MemoryStorage {
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

const DRAFT = JSON.stringify({ version: 1, savedAt: 1, values: { companyName: "Secret Customer Ltd" } });

function deviceWithDrafts() {
  const local = new MemoryStorage();
  local.setItem("qs:draft:new", DRAFT);
  local.setItem("qs:draft:edit:7:1700000000000", DRAFT);
  local.setItem("theme", "dark");
  return { local, session: new MemoryStorage() };
}

describe("sign-out on a shared device", () => {
  it("covers every key the quote editor autosaves under", () => {
    expect(quoteDraftKey()).toMatch(new RegExp(`^${QUOTE_DRAFT_PREFIX}`));
    expect(quoteDraftKey({ id: 7, updatedAt: 1 })).toMatch(new RegExp(`^${QUOTE_DRAFT_PREFIX}`));
    expect(quoteDraftPrefix(7).startsWith(QUOTE_DRAFT_PREFIX)).toBe(true);
  });

  it("drops the quote drafts and keeps other preferences", () => {
    const { local } = deviceWithDrafts();
    clearQuoteDrafts(local);
    expect([...local.map.keys()]).toEqual(["theme"]);
  });

  it("clears drafts the open editor writes back while leaving, once the login page shows", () => {
    const { local, session } = deviceWithDrafts();
    beginSignOut(local, session);
    expect(local.getItem("qs:draft:new")).toBeNull();
    // The editor flushes its pending change on pagehide, after the logout event.
    local.setItem("qs:draft:new", DRAFT);
    settleSignOut("/en/login", local, session);
    expect(local.getItem("qs:draft:new")).toBeNull();
    expect(local.getItem("theme")).toBe("dark");
    expect(session.getItem(SIGN_OUT_PENDING_KEY)).toBeNull();
  });

  it("keeps drafts when the session merely expired (no sign-out from this tab)", () => {
    const { local, session } = deviceWithDrafts();
    settleSignOut("/zh-TW/login", local, session);
    expect(local.getItem("qs:draft:new")).toBe(DRAFT);
  });

  it("forgets a sign-out that was cancelled (stayed on the page, then moved on)", () => {
    const { local, session } = deviceWithDrafts();
    beginSignOut(local, session);
    local.setItem("qs:draft:new", DRAFT); // autosave carries on
    settleSignOut("/en/quotes", local, session);
    expect(session.getItem(SIGN_OUT_PENDING_KEY)).toBeNull();
    settleSignOut("/en/login", local, session);
    expect(local.getItem("qs:draft:new")).toBe(DRAFT);
  });

  it("survives blocked storage", () => {
    const blocked = {
      get length(): number {
        throw new DOMException("denied", "SecurityError");
      },
      key: () => null,
      getItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
      removeItem: () => undefined,
    };
    expect(() => beginSignOut(blocked, blocked)).not.toThrow();
    expect(() => settleSignOut("/en/login", blocked, blocked)).not.toThrow();
    expect(() => beginSignOut(null, null)).not.toThrow();
    expect(() => settleSignOut("/en/login", null, null)).not.toThrow();
  });
});
