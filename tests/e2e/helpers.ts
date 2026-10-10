// Adapted from Invoify (https://github.com/al1abb/invoify), MIT License, Copyright (c) 2023 Ali Abbasov.
import { expect, type Page } from "@playwright/test";

export const LOCALES = ["en", "zh-TW"] as const;

/**
 * Records console errors, uncaught exceptions and failed requests while a page
 * is used. A render loop or a hydration error leaves the HTML intact, so only
 * the console reveals it.
 *
 * "Failed to load resource" console lines are dropped: the browser logs them
 * without a URL, and the response listener reports the same failure with one.
 */
export function collectProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (text.includes("Failed to load resource")) return;
    problems.push(`console: ${text}`);
  });
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  page.on("response", (res) => {
    if (res.status() < 400) return;
    problems.push(`http ${res.status()}: ${res.request().method()} ${res.url()}`);
  });
  return problems;
}

export function expectNoProblems(problems: string[]): void {
  expect(problems, `page problems:\n${problems.join("\n")}`).toEqual([]);
}

/** Every element that sticks out past the right edge of the viewport. */
export async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const offenders: { tag: string; cls: string; right: number }[] = [];

    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      // Horizontal scrollers (tables, chip rows) may be wider on purpose.
      const scroller = el.closest<HTMLElement>("[data-allow-x-overflow]");
      if (scroller) return;
      let parent = el.parentElement;
      while (parent && parent !== document.body) {
        const overflowX = getComputedStyle(parent).overflowX;
        if (overflowX === "auto" || overflowX === "scroll" || overflowX === "hidden" || overflowX === "clip") {
          return;
        }
        parent = parent.parentElement;
      }

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      if (rect.right > docWidth + 1) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: el.className?.toString().slice(0, 80) ?? "",
          right: Math.round(rect.right - docWidth),
        });
      }
    });

    return { docWidth, scrollWidth: document.documentElement.scrollWidth, offenders };
  });
}

export async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const { offenders, scrollWidth, docWidth } = await horizontalOverflow(page);
  expect(offenders, `${label} overflows horizontally:\n${JSON.stringify(offenders.slice(0, 10), null, 2)}`).toEqual([]);
  expect(scrollWidth, `${label}: the document scrolls sideways`).toBeLessThanOrEqual(docWidth + 1);
}

/** Lets late hydration errors or render loops surface before asserting. */
export async function settle(page: Page, ms = 1000): Promise<void> {
  await page.waitForLoadState("load");
  await page.waitForTimeout(ms);
}
