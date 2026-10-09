// Settings actions + service against a real, migrated Postgres. Skipped
// unless TEST_DATABASE_URL is set.
// WARNING: clears app_settings and branding_assets in that database.
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/qs_a3 npx jest tests/unit/settings/db.integration
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/auth/guard", () => ({
  assertAuthenticated: jest.fn(async () => undefined),
  isUnauthenticatedError: () => false,
}));

import { sql } from "drizzle-orm";
import { deleteBrandingAsset, saveSettings, uploadBrandingAsset } from "@/actions/settings";
import { closeDb, db } from "@/db";
import { getBrandingAsset, getSettings, invalidateSettingsCache } from "@/services/settings";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

async function storedData(): Promise<unknown> {
  const rows = (await db.execute(sql`SELECT data FROM app_settings WHERE id = 1`)) as unknown as {
    data: unknown;
  }[];
  return rows[0]?.data ?? null;
}

describeDb("settings against Postgres", () => {
  const ORIGINAL_URL = process.env.DATABASE_URL;

  beforeAll(() => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
  });

  beforeEach(async () => {
    await db.execute(sql`DELETE FROM app_settings`);
    await db.execute(sql`DELETE FROM branding_assets`);
    invalidateSettingsCache();
  });

  afterAll(async () => {
    await closeDb();
    process.env.DATABASE_URL = ORIGINAL_URL;
  });

  it("creates row 1 on first save and merges later saves per field and section", async () => {
    expect(await saveSettings("company", { name: "Acme", address: "Taipei" })).toEqual({ success: true });
    expect(await saveSettings("company", { phone: "02-1234" })).toEqual({ success: true });
    expect(await saveSettings("appearance", { brandColor: "#0f766e" })).toEqual({ success: true });
    expect(await storedData()).toEqual({
      company: { name: "Acme", address: "Taipei", phone: "02-1234" },
      appearance: { brandColor: "#0F766E" },
    });

    const s = await getSettings();
    expect(s.company).toMatchObject({ name: "Acme", address: "Taipei", phone: "02-1234", isDefault: false });
    expect(s.appearance.brandColor).toBe("#0F766E");
  });

  it("null removes a field so env/defaults apply again", async () => {
    await saveSettings("company", { name: "Acme", address: "" });
    await saveSettings("company", { address: null });
    expect(await storedData()).toEqual({ company: { name: "Acme" } });
  });

  it("bumps updated_at and the settings version on every save", async () => {
    await saveSettings("quote", { validityDays: 14 });
    const v1 = (await getSettings()).version;
    await new Promise((r) => setTimeout(r, 5));
    await saveSettings("quote", { validityDays: 14 });
    expect((await getSettings()).version).not.toBe(v1);
  });

  it("repairs a corrupt section instead of failing", async () => {
    await db.execute(sql`INSERT INTO app_settings (id, data) VALUES (1, '{"company":"oops"}'::jsonb)`);
    expect(await saveSettings("company", { name: "Fixed" })).toEqual({ success: true });
    expect(await storedData()).toEqual({ company: { name: "Fixed" } });
  });

  it("stores, serves and deletes branding uploads", async () => {
    const form = new FormData();
    form.append("kind", "stamp");
    form.append("file", new Blob([PNG]));
    expect(await uploadBrandingAsset(form)).toEqual({ success: true });

    const stamp = await getBrandingAsset("stamp");
    expect(stamp?.mime).toBe("image/png");
    expect(stamp?.data.equals(PNG)).toBe(true);
    const versionWithStamp = (await getSettings()).version;

    expect(await deleteBrandingAsset("stamp")).toEqual({ success: true });
    expect(await getBrandingAsset("stamp")).toBeNull();
    expect((await getSettings()).version).not.toBe(versionWithStamp);
  });
});
