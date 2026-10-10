import { defineConfig, devices } from "@playwright/test";
import { AUTH_STATE } from "./tests/e2e/auth-state";

/**
 * Smoke tests against the production build (what the Docker image runs).
 *
 *   npm run test:e2e                       build, start on :3100, test (needs DATABASE_URL)
 *   E2E_BASE_URL=http://127.0.0.1:3000 npm run test:e2e     test a server that is already running
 *   E2E_APP_PASSWORD=...                   sign in first (when APP_PASSWORD is set on the server)
 *
 * Specs are *.e2e.ts so Jest (which matches *.spec.ts / *.test.ts) leaves them alone.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const externalBaseURL = process.env.E2E_BASE_URL?.replace(/\/$/, "");
const baseURL = externalBaseURL ?? `http://127.0.0.1:${PORT}`;
const CI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.ts",
  outputDir: "test-results",
  // One server and one database: run serially so tests never race each other.
  workers: 1,
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",

  use: {
    baseURL,
    locale: "en-US",
    timezoneId: "Asia/Taipei",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    storageState: process.env.E2E_APP_PASSWORD ? AUTH_STATE : undefined,
  },

  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      // Chromium at 375 px rather than an iPhone preset: those run on WebKit,
      // a second browser download for everyone and for CI.
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
  ],

  webServer: externalBaseURL
    ? undefined
    : {
        command: "npm run build && node tests/e2e/start-server.mjs",
        url: `${baseURL}/api/health`,
        env: { PORT: String(PORT), NEXT_TELEMETRY_DISABLED: "1" },
        reuseExistingServer: !CI,
        // A cold production build is slow.
        timeout: 10 * 60 * 1000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
