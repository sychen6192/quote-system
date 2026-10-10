import { request, type FullConfig } from "@playwright/test";
import { AUTH_STATE } from "./auth-state";

/** Signs in once (when the server has APP_PASSWORD) and saves the cookie for every test. */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const password = process.env.E2E_APP_PASSWORD;
  if (!password) return;

  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error("playwright.config.ts must set use.baseURL");

  const api = await request.newContext({ baseURL });
  try {
    // The login route rejects cross-origin posts.
    const res = await api.post("/api/auth/login", {
      form: { password, next: "/en" },
      headers: { Origin: new URL(baseURL).origin },
      maxRedirects: 0,
    });
    const location = res.headers()["location"] ?? "";
    if (res.status() !== 303 || location.includes("error=")) {
      throw new Error(`Sign-in failed (HTTP ${res.status()}, Location: ${location || "none"}). Check E2E_APP_PASSWORD.`);
    }
    await api.storageState({ path: AUTH_STATE });
  } finally {
    await api.dispose();
  }
}
