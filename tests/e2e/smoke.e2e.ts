import { expect, test, type Page } from "@playwright/test";
import {
  LOCALES,
  collectProblems,
  expectNoHorizontalOverflow,
  expectNoProblems,
  settle,
} from "./helpers";

/**
 * Smoke tests: a tripwire for "the shipped build still works", not coverage.
 * Selectors use roles and labels (English UI) so they survive layout changes.
 */

const PAGES = [
  { name: "dashboard", path: "" },
  { name: "quotes", path: "/quotes" },
  { name: "customers", path: "/customers" },
  { name: "settings", path: "/settings" },
  { name: "new quote", path: "/quotes/new" },
] as const;

test.describe("health and PWA endpoints", () => {
  test("GET /api/health answers ok without caching", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(res.headers()["cache-control"]).toContain("no-store");
  });

  test("the web app manifest is installable", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/application\/(manifest\+)?json/);

    const manifest = await res.json();
    expect(manifest.name, "name").toBeTruthy();
    expect(manifest.short_name, "short_name").toBeTruthy();
    expect(manifest.start_url, "start_url").toBeTruthy();
    expect(manifest.display).toBe("standalone");

    const icons: { src: string; sizes?: string; type?: string; purpose?: string }[] = manifest.icons ?? [];
    const sizes = icons.flatMap((icon) => (icon.sizes ?? "").split(/\s+/));
    expect(sizes, "a 192x192 icon").toContain("192x192");
    expect(sizes, "a 512x512 icon").toContain("512x512");

    for (const icon of icons) {
      const image = await request.get(icon.src);
      expect(image.status(), `icon ${icon.src}`).toBe(200);
      expect(image.headers()["content-type"], `icon ${icon.src}`).toMatch(/^image\//);
    }
  });

  test("the service worker is served uncached with a root scope", async ({ request }) => {
    const res = await request.get("/sw.js");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/javascript/);
    expect(res.headers()["cache-control"]).toMatch(/no-cache|no-store|max-age=0/);
    expect(res.headers()["service-worker-allowed"]).toBe("/");
  });

  test("the offline page is self-contained HTML", async ({ request }) => {
    const res = await request.get("/offline.html");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/text\/html/);
  });
});

test.describe("pages render cleanly", () => {
  for (const locale of LOCALES) {
    for (const { name, path } of PAGES) {
      test(`${locale} ${name}`, async ({ page }) => {
        const problems = collectProblems(page);
        const url = `/${locale}${path}`;

        const res = await page.goto(url);
        expect(res?.status(), `GET ${url}`).toBe(200);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("h1").first()).toBeVisible();

        await settle(page);
        await expectNoHorizontalOverflow(page, url);
        expectNoProblems(problems);
      });
    }
  }

  test("/ redirects to a locale", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/(en|zh-TW)$/);
  });
});

test.describe("quotes", () => {
  test("create a quote, find it in the list and download its PDF", async ({ page }, testInfo) => {
    const problems = collectProblems(page);
    // Saving clears the dirty state, but never let a leave-page prompt block navigation.
    page.on("dialog", (dialog) => void dialog.accept());
    const company = `E2E ${testInfo.project.name} ${Date.now()}`;

    await page.goto("/en/quotes/new");
    await expect(page.locator("h1").first()).toBeVisible();

    await fillField(page, /^Company name/, company);
    const salesperson = page.getByLabel(/^Salesperson/).first();
    if ((await salesperson.inputValue()) === "") await salesperson.fill("E2E Sales");
    await fillField(page, /^Product \/ service/, "Website maintenance");
    await fillField(page, /^Qty/, "2.5");
    await fillField(page, /^Unit price/, "1200");

    await page
      .getByRole("button", { name: /^(Save quote|Save)$/ })
      .filter({ visible: true })
      .first()
      .click();

    await page.waitForURL(/\/en\/quotes\/\d+$/, { timeout: 20_000 });
    const id = Number(new URL(page.url()).pathname.split("/").pop());
    expect(id).toBeGreaterThan(0);
    await expect(page.getByText(company).filter({ visible: true }).first()).toBeVisible();

    // The list renders a table on desktop and cards on phones; one of them is hidden.
    await page.goto(`/en/quotes?q=${encodeURIComponent(company)}`);
    await expect(page.getByText(company).filter({ visible: true }).first()).toBeVisible();

    for (const lang of ["en", "zh-TW"]) {
      const pdf = await page.request.get(`/api/quotes/${id}/pdf?lang=${lang}`);
      expect(pdf.status(), `PDF (${lang})`).toBe(200);
      expect(pdf.headers()["content-type"]).toContain("application/pdf");
      expect((await pdf.body()).subarray(0, 5).toString("latin1"), `PDF (${lang}) magic bytes`).toBe("%PDF-");
    }

    await settle(page, 500);
    expectNoProblems(problems);
  });
});

test.describe("sign-in", () => {
  test.skip(!process.env.E2E_APP_PASSWORD, "the server has no APP_PASSWORD (set E2E_APP_PASSWORD to run)");

  test("pages need a session, the health check does not", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto("/en/quotes");
    await expect(page).toHaveURL(/\/en\/login\?/);
    expect((await page.request.get("/api/health")).status()).toBe(200);
    expect((await page.request.get("/api/quotes/1/pdf")).status()).toBe(401);
    await context.close();
  });
});

async function fillField(page: Page, label: RegExp, value: string): Promise<void> {
  const field = page.getByLabel(label).filter({ visible: true }).first();
  await field.fill(value);
  await expect(field).toHaveValue(value);
}
