import * as fs from "node:fs";
import * as path from "node:path";

const isAuthenticated = jest.fn();
const redirect = jest.fn((url: string) => {
  throw Object.assign(new Error("NEXT_REDIRECT"), { url });
});

jest.mock("@/lib/auth/guard", () => ({ isAuthenticated: () => isAuthenticated() }));
jest.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

import { pagePath, requireSession } from "@/components/app-shell/require-session";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("pagePath", () => {
  it("builds the page's own URL, query included", () => {
    expect(pagePath("en", "")).toBe("/en");
    expect(pagePath("zh-TW", "/quotes", { status: "sent", q: "Acme & Co", page: undefined })).toBe(
      "/zh-TW/quotes?status=sent&q=Acme+%26+Co"
    );
    expect(pagePath("en", "/customers", { tag: ["a", "b"] })).toBe("/en/customers?tag=a&tag=b");
  });
});

describe("requireSession", () => {
  it("lets a signed-in request (or any request without APP_PASSWORD) through", async () => {
    isAuthenticated.mockResolvedValue(true);
    await expect(requireSession("en", "/en/quotes/7")).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("sends a signed-out request to sign in, back to the page afterwards", async () => {
    isAuthenticated.mockResolvedValue(false);
    await expect(requireSession("zh-TW", "/zh-TW/quotes?status=sent")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/zh-TW/login?next=%2Fzh-TW%2Fquotes%3Fstatus%3Dsent");
  });

  it("never leads back off-site", async () => {
    isAuthenticated.mockResolvedValue(false);
    await expect(requireSession("en", "//evil.example/x")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/en/login?next=%2Fen");
  });
});

// Defence in depth for routes the proxy might miss (the /_next/<page> leak):
// every [locale] page checks the locale and the session before it loads data.
describe("[locale] pages", () => {
  const APP = path.join(__dirname, "../../../app/[locale]");
  const DATA_CALLS =
    /\b(getSettings|getDocumentBranding|getQuotesList|getQuoteById|loadQuote|getCustomerDirectory|getLatestCustomerByName|getDashboardMetrics|getExpiringSoon|getRecentQuotes|getBrandingStatus|loadSettingsPageData)\(/;

  function files(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? files(full) : [full];
    });
  }

  const sources = files(APP)
    .filter((file) => /[\\/](page|layout)\.tsx$/.test(file))
    .map((file) => ({ name: path.relative(APP, file), text: fs.readFileSync(file, "utf8") }))
    .filter(({ text }) => DATA_CALLS.test(text.slice(text.indexOf("export default"))));

  it("finds the pages that load data", () => {
    expect(sources.map((s) => s.name).sort()).toEqual(
      [
        "(dashboard)/page.tsx",
        "customers/page.tsx",
        "quotes/(list)/page.tsx",
        "quotes/[id]/(detail)/layout.tsx",
        "quotes/[id]/(detail)/page.tsx",
        "quotes/[id]/edit/layout.tsx",
        "quotes/[id]/edit/page.tsx",
        "quotes/new/page.tsx",
        "settings/page.tsx",
      ].map((name) => path.normalize(name))
    );
  });

  it.each(sources.map((s) => [s.name, s.text] as const))(
    "%s checks the locale, then the session, before loading anything",
    (_name, text) => {
      const body = text.slice(text.indexOf("export default"));
      const locale = body.indexOf("if (!hasLocale(routing.locales, locale)) notFound();");
      const session = body.indexOf("await requireSession(locale, ");
      const data = body.search(DATA_CALLS);
      expect(locale).toBeGreaterThan(-1);
      expect(session).toBeGreaterThan(locale);
      expect(data).toBeGreaterThan(session);
    }
  );

  it.each(
    sources
      .filter(({ text }) => /export async function generateMetadata[\s\S]*loadQuote\(/.test(text))
      .map((s) => [s.name, s.text] as const)
  )("%s: generateMetadata reads the quote only when signed in", (_name, text) => {
    const meta = text.slice(text.indexOf("export async function generateMetadata"));
    expect(meta.indexOf("if (!(await isAuthenticated())) return {};")).toBeGreaterThan(-1);
    expect(meta.indexOf("loadQuote(")).toBeGreaterThan(meta.indexOf("isAuthenticated()"));
  });
});
