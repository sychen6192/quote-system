import { isAppLocale, localeFromPath, loginPath, safeNextPath } from "@/lib/auth/paths";

describe("safeNextPath", () => {
  it.each([
    ["/en/quotes", "/en/quotes"],
    ["/en/quotes?status=sent&page=2", "/en/quotes?status=sent&page=2"],
    ["/zh-TW/quotes/1#items", "/zh-TW/quotes/1#items"],
    ["/quotes/new", "/quotes/new"],
    ["/", "/"],
  ])("keeps same-site path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it("normalises dot segments without leaving the site", () => {
    expect(safeNextPath("/en/../zh-TW/quotes")).toBe("/zh-TW/quotes");
    expect(safeNextPath("/./en/quotes")).toBe("/en/quotes");
    // An encoded slash is not a path separator: stays a same-site path.
    expect(safeNextPath("/.%2F/evil.example")).toBe("/.%2F/evil.example");
  });

  it.each([
    "//evil.example/x",
    "/\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "\\\\evil.example",
    "https://evil.example/",
    "javascript:alert(1)",
    "evil.example",
    "",
    " /en",
    "/en/\u0000",
    // Dot segments that collapse into a protocol-relative path once parsed.
    "/.//evil.example",
    "/..//evil.example",
    "/a/..//evil.example",
    "/en/..//evil.example",
    "/%2e//evil.example",
    "/%2E//evil.example",
    "/%2E%2E//evil.example",
    "/.///evil.example",
    "/././/evil.example/x?y#z",
  ])("rejects %j", (input) => {
    expect(safeNextPath(input, "/en")).toBe("/en");
  });

  it("rejects non-strings and absurdly long values", () => {
    expect(safeNextPath(undefined, "/zh-TW")).toBe("/zh-TW");
    expect(safeNextPath(null)).toBe("/en");
    expect(safeNextPath(["/en/quotes"], "/x")).toBe("/x");
    expect(safeNextPath(`/${"a".repeat(3000)}`, "/x")).toBe("/x");
  });
});

describe("locale helpers", () => {
  it("reads the locale prefix", () => {
    expect(localeFromPath("/en")).toBe("en");
    expect(localeFromPath("/zh-TW/quotes/1")).toBe("zh-TW");
    expect(localeFromPath("/zh-tw/quotes")).toBeNull();
    expect(localeFromPath("/quotes")).toBeNull();
    expect(localeFromPath("/")).toBeNull();
  });

  it("recognises app locales only", () => {
    expect(isAppLocale("en")).toBe(true);
    expect(isAppLocale("zh-TW")).toBe(true);
    expect(isAppLocale("fr")).toBe(false);
    expect(isAppLocale(undefined)).toBe(false);
  });

  it("builds the login path with an encoded next", () => {
    expect(loginPath("en")).toBe("/en/login");
    expect(loginPath("zh-TW", "/zh-TW/quotes?status=sent")).toBe(
      "/zh-TW/login?next=%2Fzh-TW%2Fquotes%3Fstatus%3Dsent"
    );
  });
});
