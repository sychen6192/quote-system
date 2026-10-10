import { NAV_ITEMS, isNavActive, shellChrome } from "@/components/app-shell/nav-config";
import { firstParam, mergeQuery, withQuery } from "@/components/app-shell/query";

describe("isNavActive", () => {
  it("matches the dashboard exactly", () => {
    expect(isNavActive("/", "/")).toBe(true);
    expect(isNavActive("/", "/quotes")).toBe(false);
  });

  it("matches a section and its sub-pages, not look-alike prefixes", () => {
    expect(isNavActive("/quotes", "/quotes")).toBe(true);
    expect(isNavActive("/quotes", "/quotes/12")).toBe(true);
    expect(isNavActive("/quotes", "/quotes/new")).toBe(true);
    expect(isNavActive("/quotes", "/quotes/")).toBe(true);
    expect(isNavActive("/quotes", "/quotesx")).toBe(false);
    expect(isNavActive("/customers", "/quotes")).toBe(false);
  });

  it("ignores query strings", () => {
    expect(isNavActive("/quotes", "/quotes?status=sent")).toBe(true);
  });

  it("has exactly one active item for each section page", () => {
    for (const path of ["/", "/quotes", "/quotes/3/edit", "/customers", "/settings"]) {
      expect(NAV_ITEMS.filter((item) => isNavActive(item.href, path))).toHaveLength(1);
    }
  });
});

describe("shellChrome", () => {
  it("shows nav and tab bar on list pages", () => {
    for (const path of ["/", "/quotes", "/customers", "/settings", "/does-not-exist"]) {
      expect(shellChrome(path)).toEqual({ nav: true, tabBar: true });
    }
  });

  it("hides the tab bar on pages with their own action bar", () => {
    for (const path of ["/quotes/new", "/quotes/12", "/quotes/12/", "/quotes/12/edit"]) {
      expect(shellChrome(path)).toEqual({ nav: true, tabBar: false });
    }
  });

  it("keeps the tab bar for non-numeric quote paths (404 page)", () => {
    expect(shellChrome("/quotes/abc").tabBar).toBe(true);
  });

  it("hides all chrome on the login page", () => {
    expect(shellChrome("/login")).toEqual({ nav: false, tabBar: false });
  });
});

describe("query helpers", () => {
  it("firstParam takes the first trimmed value", () => {
    expect(firstParam(undefined)).toBe("");
    expect(firstParam(" a ")).toBe("a");
    expect(firstParam(["x", "y"])).toBe("x");
  });

  it("mergeQuery applies a patch, drops empties and resets the page", () => {
    const base = { q: "acme", status: "sent", page: "3", sort: "" };
    expect(mergeQuery(base, { status: "draft" }).toString()).toBe("q=acme&status=draft");
    expect(mergeQuery(base, { q: "" }).toString()).toBe("status=sent");
    expect(mergeQuery(base).toString()).toBe("page=3&q=acme&status=sent");
  });

  it("mergeQuery keeps an explicit page and drops page=1", () => {
    const base = new URLSearchParams("q=acme&page=2");
    expect(mergeQuery(base, { page: 4 }).toString()).toBe("page=4&q=acme");
    expect(mergeQuery(base, { page: 1 }).toString()).toBe("q=acme");
  });

  it("encodes non-ASCII values", () => {
    const params = mergeQuery({}, { q: "宏達 電子" });
    expect(withQuery("/quotes", params)).toBe("/quotes?q=%E5%AE%8F%E9%81%94+%E9%9B%BB%E5%AD%90");
    expect(withQuery("/quotes", new URLSearchParams())).toBe("/quotes");
  });
});
