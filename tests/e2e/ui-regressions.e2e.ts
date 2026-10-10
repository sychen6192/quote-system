import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Regression tests for UI bugs found in review (Wave C). Each one creates the
 * data it needs, so they run against any database.
 */

const AXE = fs.readFileSync(path.join(process.cwd(), "node_modules/axe-core/axe.min.js"), "utf8");

async function fillQuote(page: Page, company: string, item = "Widget", price = "100") {
  await page.locator('[name="companyName"]').fill(company);
  const salesperson = page.locator('[name="salesperson"]');
  if ((await salesperson.inputValue()) === "") await salesperson.fill("E2E Sales");
  await page.locator('[name="items.0.productName"]').fill(item);
  await page.locator('[name="items.0.unitPrice"]').fill(price);
}

async function createQuote(page: Page, company: string, dates?: { issued: string; validUntil: string }) {
  await page.goto("/en/quotes/new");
  await fillQuote(page, company);
  if (dates) {
    await page.locator('[name="issuedDate"]').fill(dates.issued);
    await page.locator('[name="validUntil"]').fill(dates.validUntil);
  }
  await page.keyboard.press("Control+s");
  await page.waitForURL(/\/en\/quotes\/\d+$/, { timeout: 20_000 });
  return Number(new URL(page.url()).pathname.split("/").pop());
}

/** Text of every toast shown from now on, including ones that already left. */
async function recordToasts(page: Page): Promise<string[]> {
  const seen: string[] = [];
  await page.exposeFunction("__recordToast", (text: string) => seen.push(text));
  await page.addInitScript(() => {
    new MutationObserver(() => {
      document.querySelectorAll<HTMLElement>("[data-sonner-toast]").forEach((toast) => {
        if (toast.dataset.recorded) return;
        toast.dataset.recorded = "1";
        (window as unknown as { __recordToast(text: string): void }).__recordToast(toast.textContent ?? "");
      });
    }).observe(document, { childList: true, subtree: true });
  });
  return seen;
}

test.describe("quote editor", () => {
  test.beforeEach(({ page }) => {
    page.on("dialog", (dialog) => void dialog.accept());
  });

  // Saving navigates away while the item-name suggestion search is still in
  // flight; its aborted request used to be reported as an expired session
  // (toast + hard reload) on servers without a password.
  test("saving straight after typing in a suggestion field never reports an expired session", async ({ page }) => {
    const toasts = await recordToasts(page);
    await page.goto("/en/quotes/new");
    await fillQuote(page, `E2E race ${Date.now()}`, "");
    const name = page.locator('[name="items.0.productName"]');
    await name.click();
    await name.pressSequentially("Wid", { delay: 20 });
    // Let the 200 ms debounce fire the search, then save at once.
    await page.waitForTimeout(210);
    await page.keyboard.press("Control+s");
    await page.waitForURL(/\/en\/quotes\/\d+$/, { timeout: 20_000 });
    await page.waitForTimeout(2_000);
    expect(toasts.filter((text) => /session/i.test(text))).toEqual([]);
    await expect(page).toHaveURL(/\/en\/quotes\/\d+$/);
  });

  test("Duplicate and 'New quote for a customer' never overwrite an unsaved new quote", async ({ page }) => {
    const draft = (key: string) =>
      page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null")?.values?.companyName ?? null, key);

    await page.goto("/en/quotes/new");
    await page.locator('[name="companyName"]').fill("Half-done Customer");
    await expect.poll(() => draft("qs:draft:new")).toBe("Half-done Customer");

    await page.goto("/en/quotes/new?customer=Globex");
    await page.locator('[name="title"]').fill("x");
    await expect.poll(() => draft("qs:draft:new:customer:globex")).toBe("Globex");
    expect(await draft("qs:draft:new")).toBe("Half-done Customer");

    await page.goto("/en/quotes/new");
    await page.getByRole("button", { name: "Restore draft" }).click();
    await expect(page.locator('[name="companyName"]')).toHaveValue("Half-done Customer");
  });

  // Enter in the last price adds a row (the hint says so); an untouched row
  // must not block saving with "required" errors on fields that looked like 0.
  // iOS Safari gave date inputs native chrome and an intrinsic min-width, so
  // the issue/valid-until fields stuck out of their card on phones. Chromium
  // never showed it; assert the reset that prevents it is applied and that the
  // fields stay inside their card and as tall as the other inputs.
  test("date fields size like the other inputs and stay inside their card", async ({ page }) => {
    await page.goto("/en/quotes/new");
    const salespersonInput = page.locator('[name="salesperson"]');
    await expect(salespersonInput).toBeVisible();
    for (const name of ["issuedDate", "validUntil"]) {
      const input = page.locator(`[name="${name}"]`);
      await expect(input).toBeVisible();
      const style = await input.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { appearance: cs.appearance, minWidth: cs.minWidth };
      });
      expect(style).toEqual({ appearance: "none", minWidth: "0px" });

      const box = await input.boundingBox();
      const card = await input.evaluate((el) => {
        const r = (el.closest("section, [data-slot=card], .rounded-xl") ?? el.parentElement!).getBoundingClientRect();
        return { right: r.right };
      });
      const salesperson = await salespersonInput.boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(card.right + 0.5);
      expect(Math.abs(box!.height - salesperson!.height)).toBeLessThanOrEqual(1);
    }
  });

  test("Save drops a blank row added with Enter", async ({ page }) => {
    await page.goto("/en/quotes/new");
    await fillQuote(page, `E2E blank row ${Date.now()}`, "Free installation", "0");
    await page.locator('[name="items.0.unitPrice"]').press("Enter");
    await expect(page.locator('[name="items.1.productName"]')).toBeVisible();
    await expect(page.locator('[name="items.1.unitPrice"]')).not.toHaveAttribute("placeholder", "0");
    await page.keyboard.press("Control+s");
    await page.waitForURL(/\/en\/quotes\/\d+$/, { timeout: 20_000 });
  });
});

test.describe("quotes list", () => {
  test("deleting from the row menu with the keyboard keeps focus in the page", async ({ page }) => {
    const tag = `E2E focus ${Date.now()}`;
    await createQuote(page, `${tag} A`);
    await createQuote(page, `${tag} B`);
    await page.goto(`/zh-TW/quotes?q=${encodeURIComponent(tag)}`);

    const rows = page.locator("[data-quote-row]").filter({ visible: true });
    await expect(rows).toHaveCount(2);
    await rows.first().locator("[data-row-actions]").focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: "刪除" }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("alertdialog").getByRole("button", { name: "刪除報價單" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "已刪除報價單" })).toBeVisible();
    await expect(rows).toHaveCount(1);

    const focus = await page.evaluate(() => ({
      body: document.activeElement === document.body,
      inMain: Boolean(document.activeElement?.closest("main")),
    }));
    expect(focus).toEqual({ body: false, inMain: true });
  });
});

test.describe("contrast", () => {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`default theme text reaches 4.5:1 (${colorScheme})`, async ({ browser, baseURL, storageState }) => {
      const context = await browser.newContext({ baseURL, storageState, colorScheme, locale: "zh-TW" });
      const page = await context.newPage();
      // An expired quote: its notice sits on a warning tint.
      const id = await createQuote(page, `E2E expired ${Date.now()}`, { issued: "2026-01-01", validUntil: "2026-01-31" });
      for (const url of ["/zh-TW/quotes", `/zh-TW/quotes/${id}`]) {
        await page.goto(url);
        await page.addScriptTag({ content: AXE });
        const violations = await page.evaluate(async () => {
          const axe = (window as unknown as { axe: { run(context: Document, options: object): Promise<{ violations: { nodes: { target: string[] }[] }[] }> } }).axe;
          const result = await axe.run(document, { runOnly: ["color-contrast"] });
          return result.violations.flatMap((v) => v.nodes.map((n) => n.target.join(" ")));
        });
        expect(violations, `${url} color-contrast`).toEqual([]);
      }
      await context.close();
    });
  }
});

test.describe("language", () => {
  // The chosen UI language must survive closing the browser or the installed
  // app (a session cookie is dropped on every relaunch).
  test("remembers the chosen language across restarts", async ({ browser, baseURL, storageState }) => {
    const context = await browser.newContext({ baseURL, storageState, locale: "en-US" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await page.getByRole("button", { name: "Switch language to 繁體中文" }).first().click();
    await expect(page).toHaveURL(/\/zh-TW/);
    const cookie = (await context.cookies()).find((c) => c.name === "NEXT_LOCALE");
    expect(cookie?.value).toBe("zh-TW");
    expect(cookie?.expires ?? -1).toBeGreaterThan(Date.now() / 1000 + 300 * 86400);

    // A relaunch keeps only persistent cookies.
    const kept = (await context.cookies()).filter((c) => c.expires > 0);
    await context.close();
    const relaunched = await browser.newContext({ baseURL, locale: "en-US" });
    await relaunched.addCookies(kept);
    const again = await relaunched.newPage();
    await again.goto("/");
    await expect(again).toHaveURL(/\/zh-TW$/);
    await relaunched.close();
  });
});

test.describe("expired session", () => {
  test.skip(!process.env.E2E_APP_PASSWORD, "the server has no APP_PASSWORD (set E2E_APP_PASSWORD to run)");

  // The API answers 401 JSON; a bare <a download> saved it as a cancelled
  // "pdf.json" without a word. Every other action sends people to sign in.
  test("Download PDF goes to the sign-in page", async ({ page, context }) => {
    const id = await createQuote(page, `E2E download ${Date.now()}`);
    await page.goto(`/zh-TW/quotes/${id}`);
    await context.clearCookies();
    await page.getByRole("link", { name: "下載 PDF" }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/zh-TW\/login/, { timeout: 10_000 });
  });

  test("the sign-in page does not carry the salesperson's name or feature flags", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const html = await (await page.request.get("/en/login")).text();
    expect(html).toContain('defaultSalesperson\\":\\"\\"');
    expect(html).toContain('mailEnabled\\":false');
    await context.close();
  });
});
