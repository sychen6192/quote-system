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

  test("pages link one manifest, fetched with credentials", async ({ page }) => {
    // Without crossorigin="use-credentials" browsers fetch the manifest
    // without cookies, and a login proxy in front of the app (Cloudflare
    // Access, docs/deploy/https.md) answers with its login page instead.
    for (const locale of LOCALES) {
      await page.goto(`/${locale}`);
      const links = page.locator('link[rel="manifest"]');
      await expect(links).toHaveCount(1);
      await expect(links).toHaveAttribute("href", "/manifest.webmanifest");
      await expect(links).toHaveAttribute("crossorigin", "use-credentials");
    }
  });

  test("the web app manifest is installable", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/^application\/manifest\+json/);

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

  test("robots.txt keeps the whole app out of search engines", async ({ request }) => {
    // Public even with APP_PASSWORD set (proxy-rules allow-lists it).
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    expect(await res.text()).toMatch(/^Disallow: \/$/m);
    expect(res.headers()["x-robots-tag"]).toContain("noindex");
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

  test("the company field lists recent customers and fills in their details", async ({ page }, testInfo) => {
    page.on("dialog", (dialog) => void dialog.accept());
    const company = `E2E Recent ${testInfo.project.name} ${Date.now()}`;

    await page.goto("/en/quotes/new");
    await page.locator('[name="companyName"]').fill(company);
    await page.locator('[name="contactPerson"]').fill("Ms. Lin");
    await page.locator('[name="phone"]').fill("02-2345-6789");
    await page.locator('[name="vatNumber"]').fill("12345675");
    await page.locator('[name="paymentMethod"]').fill("Net 45");
    await page.locator('[name="shippingMethod"]').fill("Courier");
    const salesperson = page.locator('[name="salesperson"]');
    if ((await salesperson.inputValue()) === "") await salesperson.fill("E2E Sales");
    await page.locator('[name="items.0.productName"]').fill("Consulting");
    await page.locator('[name="items.0.unitPrice"]').fill("100");
    await page.keyboard.press("Control+s");
    await page.waitForURL(/\/en\/quotes\/\d+$/, { timeout: 20_000 });

    // A click on the empty field opens the list: the newest customer comes first.
    await page.goto("/en/quotes/new");
    const name = page.locator('[name="companyName"]');
    await expect(name).toHaveValue("");
    await name.click();
    const list = page.getByRole("listbox", { name: "Recent customers" });
    await expect(list.getByRole("option").first()).toContainText(company);
    await list.getByRole("option").first().click();

    await expect(name).toHaveValue(company);
    await expect(page.locator('[name="contactPerson"]')).toHaveValue("Ms. Lin");
    await expect(page.locator('[name="phone"]')).toHaveValue("02-2345-6789");
    await expect(page.locator('[name="vatNumber"]')).toHaveValue("12345675");
    // ...and the payment terms and delivery method of their last quote.
    await expect(page.locator('[name="paymentMethod"]')).toHaveValue("Net 45");
    await expect(page.locator('[name="shippingMethod"]')).toHaveValue("Courier");
    await expect(page.getByText("Used the terms from their last quote")).toBeVisible();
    await expect(list).toBeHidden();

    // The ▾ button opens and closes the list too.
    const toggle = page.getByRole("button", { name: "Show saved customers" });
    await toggle.click();
    await expect(page.getByRole("listbox").getByRole("option").first()).toContainText(company);
    await toggle.click();
    await expect(page.getByRole("listbox")).toBeHidden();

    // Terms typed by hand stay; empty ones are filled.
    await page.goto("/en/quotes/new");
    await page.locator('[name="paymentMethod"]').fill("Cash on delivery");
    await name.click();
    await page.getByRole("listbox", { name: "Recent customers" }).getByRole("option").first().click();
    await expect(name).toHaveValue(company);
    await expect(page.locator('[name="paymentMethod"]')).toHaveValue("Cash on delivery");
    await expect(page.locator('[name="shippingMethod"]')).toHaveValue("Courier");
  });

  test("a new quote starts with the salesperson of the last quote saved on this device", async ({ page }) => {
    page.on("dialog", (dialog) => void dialog.accept());
    await page.goto("/en/quotes/new");
    const salesperson = page.locator('[name="salesperson"]');
    test.skip((await salesperson.inputValue()) !== "", "Settings has a default salesperson, which comes first");

    await page.locator('[name="companyName"]').fill(`E2E Salesperson ${Date.now()}`);
    await salesperson.fill("Mei Lin");
    await page.locator('[name="items.0.productName"]').fill("Consulting");
    await page.locator('[name="items.0.unitPrice"]').fill("100");
    await page.keyboard.press("Control+s");
    await page.waitForURL(/\/en\/quotes\/\d+$/, { timeout: 20_000 });

    await page.goto("/en/quotes/new");
    await expect(salesperson).toHaveValue("Mei Lin");
    // Prefilled, not typed: going back asks nothing (no "Discard changes?").
    await page.getByRole("button", { name: "Back to Quotes" }).click();
    await page.waitForURL(/\/en\/quotes$/, { timeout: 10_000 });
  });

  test("the item field lists recently used items and fills in their price", async ({ page }, testInfo) => {
    page.on("dialog", (dialog) => void dialog.accept());
    const item = `E2E item ${testInfo.project.name} ${Date.now()}`;

    await page.goto("/en/quotes/new");
    await page.locator('[name="companyName"]').fill(`E2E Items ${Date.now()}`);
    const salesperson = page.locator('[name="salesperson"]');
    if ((await salesperson.inputValue()) === "") await salesperson.fill("E2E Sales");
    await page.locator('[name="items.0.productName"]').fill(item);
    await page.locator('[name="items.0.unit"]').fill("hr");
    await page.locator('[name="items.0.unitPrice"]').fill("1250");
    await page.keyboard.press("Control+s");
    await page.waitForURL(/\/en\/quotes\/\d+$/, { timeout: 20_000 });

    await page.goto("/en/quotes/new");
    await page.locator('[name="items.0.productName"]').click();
    const list = page.getByRole("listbox", { name: "Recently used items" });
    await expect(list.getByRole("option").first()).toContainText(item);
    await list.getByRole("option").first().click();

    await expect(page.locator('[name="items.0.productName"]')).toHaveValue(item);
    await expect(page.locator('[name="items.0.unit"]')).toHaveValue("hr");
    await expect(page.locator('[name="items.0.unitPrice"]')).toHaveValue(/^1,?250(\.00)?$/);
    // Picking moves on to the quantity, ready to type.
    await expect(page.locator('[name="items.0.quantity"]')).toBeFocused();
  });

  test("a downloaded draft offers to be marked sent, and the list menu changes the status", async ({ page }, testInfo) => {
    const problems = collectProblems(page);
    page.on("dialog", (dialog) => void dialog.accept());
    const company = `E2E Status ${testInfo.project.name} ${Date.now()}`;
    const id = await createQuote(page, company);
    const prompt = page.getByText(/^Sent .+ to the customer\?$/);
    const markSent = page.getByRole("button", { name: "Mark as sent" });
    // A click on a toast's button must not take focus: sonner hands it back
    // once the toasts are gone, which would close a menu opened meanwhile.
    const focusInToaster = () =>
      page.evaluate(() => document.activeElement?.closest("[data-sonner-toaster]") != null);

    // From the list: download the draft's PDF, then take up the offer.
    await page.goto(`/en/quotes?q=${encodeURIComponent(company)}`);
    const row = page.locator(`[data-quote-id="${id}"]`).filter({ visible: true }).first();
    const menu = row.getByRole("button", { name: /^Actions for quote / });
    await expect(row.getByText("Draft", { exact: true })).toBeVisible();
    await menu.click();
    const listDownload = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "Download PDF" }).click();
    await listDownload;
    await expect(prompt).toBeVisible();
    await markSent.click();
    expect(await focusInToaster()).toBe(false);
    await expect(page.getByText("Marked as Sent")).toBeVisible();
    await expect(row.getByText("Sent", { exact: true })).toBeVisible();
    await expect(prompt).toHaveCount(0);

    // Any status from the menu, with Undo.
    await menu.click();
    await expect(page.getByRole("menuitemradio", { name: "Sent" })).toBeChecked();
    await page.getByRole("menuitemradio", { name: "Accepted" }).click();
    await expect(page.getByText("Marked as Accepted")).toBeVisible();
    await expect(row.getByText("Accepted", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    expect(await focusInToaster()).toBe(false);
    await expect(row.getByText("Sent", { exact: true })).toBeVisible();
    await menu.click();
    await page.getByRole("menuitemradio", { name: "Draft" }).click();
    await expect(row.getByText("Draft", { exact: true })).toBeVisible();

    // On the quote: the draft's download offers it too; a sent quote's doesn't.
    await page.goto(`/en/quotes/${id}`);
    const download = page.getByRole("link", { name: "Download PDF" }).filter({ visible: true }).first();
    let saved = page.waitForEvent("download");
    await download.click();
    await saved;
    await expect(prompt).toBeVisible();
    await markSent.click();
    await expect(page.getByText("Marked as Sent")).toBeVisible();
    saved = page.waitForEvent("download");
    await download.click();
    await saved;
    await settle(page, 500);
    await expect(prompt).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("Sent", { exact: true }).filter({ visible: true }).first()).toBeVisible();

    expectNoProblems(problems);
  });
});

test.describe("private data never leaks through /_next/<page>", () => {
  // Next routed /_next/<anything> into [locale] with the locale "_next" and
  // rendered that page into the 404 body: before 1.0.1, /_next/quotes/1 showed
  // quote 1 and /_next/settings the bank account to anyone, signed in or not.
  test("quote and settings pages under /_next/ are an empty 404", async ({ page, browser, baseURL }, testInfo) => {
    test.setTimeout(120_000);
    page.on("dialog", (dialog) => void dialog.accept());
    const customer = `E2E leak ${testInfo.project.name} ${Date.now()}`;
    const id = await createQuote(page, customer);
    const number = (await page.locator("h1").first().innerText()).trim();
    expect(number).not.toBe("");
    const account = `9${String(Date.now()).slice(-9)}7`;

    const restoreAccount = await setBankAccountNumber(page, account);
    const anonymous = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    try {
      // The real pages carry what the probes look for, so its absence below means something.
      expect(await (await page.request.get(`/en/quotes/${id}`)).text()).toContain(customer);
      expect(await (await page.request.get("/en/settings")).text()).toContain(account);

      const secrets = { number, customer, account };
      const paths = [`/_next/quotes/${id}`, `/_next/quotes/${id}/edit`, "/_next/settings", "/_next/quotes", "/_next/customers"];
      const clients = [
        { who: "signed out", request: anonymous.request },
        { who: "signed in", request: page.request },
      ];
      for (const { who, request } of clients) {
        for (const path of paths) {
          for (const headers of [{}, { RSC: "1" }] as Record<string, string>[]) {
            const label = `${who} GET ${path}${"RSC" in headers ? " (RSC)" : ""}`;
            const res = await request.get(path, { headers, maxRedirects: 0 });
            const body = await res.text();
            expect(res.status(), label).toBe(404);
            for (const [what, value] of Object.entries(secrets)) {
              expect(body.includes(value), `${label} contains the ${what}`).toBe(false);
            }
          }
        }
      }
    } finally {
      await anonymous.close();
      await restoreAccount();
    }
  });
});

test.describe("host names with sign-in off", () => {
  test.skip(!!process.env.E2E_APP_PASSWORD, "sign-in is on: APP_HOSTS is not used");
  const appHosts = (process.env.E2E_APP_HOSTS ?? "").split(",").map((h) => h.trim()).filter(Boolean);

  test("without APP_HOSTS any host name is served", async ({ request }) => {
    test.skip(appHosts.length > 0, "the server has APP_HOSTS (E2E_APP_HOSTS is set)");
    // The allow-list is opt-in, so an upgrade never locks out an install
    // reached through its own domain (the app logs a warning instead).
    const res = await request.get("/robots.txt", { headers: { Host: "quotes.example.com" } });
    expect(res.status()).toBe(200);
  });

  test("with APP_HOSTS other names get 421, listed and local names are served", async ({ request, baseURL }) => {
    test.skip(appHosts.length === 0, "set E2E_APP_HOSTS to the server's APP_HOSTS to run");
    const port = new URL(baseURL!).port;
    const listed = appHosts.find((h) => !h.includes("*"));
    const served = [`127.0.0.1:${port}`, `localhost:${port}`, "quotes", "nas.local", ...(listed ? [listed] : [])];
    for (const host of served) {
      expect((await request.get("/robots.txt", { headers: { Host: host } })).status(), host).toBe(200);
    }

    const foreign = "rebind.attacker.example";
    for (const path of ["/robots.txt", "/en/quotes", "/api/export/quotes"]) {
      const res = await request.get(path, { headers: { Host: foreign }, maxRedirects: 0 });
      expect(res.status(), path).toBe(421);
      expect(await res.text()).toContain("Unknown host");
    }
    // A page may add X-Forwarded-Host but cannot change Host: both must pass.
    const forwarded = await request.get("/robots.txt", { headers: { "X-Forwarded-Host": foreign } });
    expect(forwarded.status()).toBe(421);
    // Health checks work under any name.
    expect((await request.get("/api/health", { headers: { Host: foreign } })).status()).toBe(200);
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

/** Creates a quote through the editor and returns its id (the page ends on the quote). */
async function createQuote(page: Page, company: string): Promise<number> {
  await page.goto("/en/quotes/new");
  await page.locator('[name="companyName"]').fill(company);
  const salesperson = page.locator('[name="salesperson"]');
  if ((await salesperson.inputValue()) === "") await salesperson.fill("E2E Sales");
  await page.locator('[name="items.0.productName"]').fill("Leak probe");
  await page.locator('[name="items.0.unitPrice"]').fill("100");
  await page
    .getByRole("button", { name: /^(Save quote|Save)$/ })
    .filter({ visible: true })
    .first()
    .click();
  await page.waitForURL(/\/en\/quotes\/\d+$/, { timeout: 20_000 });
  return Number(new URL(page.url()).pathname.split("/").pop());
}

/** Saves the bank account number on the Settings page; returns a function that puts the old one back. */
async function setBankAccountNumber(page: Page, value: string): Promise<() => Promise<void>> {
  async function save(next: string) {
    await page.goto("/en/settings#payment");
    const field = page.getByLabel("Account number", { exact: true }).filter({ visible: true }).first();
    await expect(field).toBeVisible();
    const previous = await field.inputValue();
    if (previous === next) return previous;
    await field.fill(next);
    await page.getByRole("button", { name: "Save changes" }).filter({ visible: true }).first().click();
    await expect(page.getByText("All changes saved").filter({ visible: true }).first()).toBeVisible();
    return previous;
  }
  const previous = await save(value);
  return async () => {
    await save(previous);
  };
}

async function fillField(page: Page, label: RegExp, value: string): Promise<void> {
  const field = page.getByLabel(label).filter({ visible: true }).first();
  await field.fill(value);
  await expect(field).toHaveValue(value);
}
