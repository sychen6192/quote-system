// next-intl is ESM-only, so the routing config is checked through a
// pass-through defineRouting; tsc checks the option shape against next-intl's
// types, and the e2e language test checks the cookie in a real browser.
jest.mock("next-intl/routing", () => ({ defineRouting: <T,>(config: T) => config }));
jest.mock("next-intl/navigation", () => ({ createNavigation: () => ({}) }));

import { routing } from "@/navigation";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_MAX_AGE_SECONDS,
  LOCALE_COOKIE_NAME,
  LOCALES,
} from "@/i18n/locales";

describe("language cookie", () => {
  it("is persistent for a year, so the language survives restarts", () => {
    expect(LOCALE_COOKIE_MAX_AGE_SECONDS).toBe(31_536_000);
    expect(routing.localeCookie).toEqual({ name: "NEXT_LOCALE", maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS });
  });

  it("keeps next-intl's cookie name, which the PDF, CSV and sign-in routes read", () => {
    expect(LOCALE_COOKIE_NAME).toBe("NEXT_LOCALE");
  });

  it("routes the app's locales", () => {
    expect(routing).toMatchObject({ locales: LOCALES, defaultLocale: DEFAULT_LOCALE });
  });
});
