jest.mock("@/db", () => ({ db: { select: jest.fn() } }));
jest.mock("drizzle-orm", () => ({
  ...jest.requireActual("drizzle-orm"),
  // Lets the fake DB see which branding kind a query asks for.
  eq: (column: unknown, value: unknown) => ({ column, value }),
}));

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { db } from "@/db";
import { appSettings, brandingAssets } from "@/db/schema";
import {
  SETTINGS_TTL_MS,
  getBrandingAsset,
  getDocumentBranding,
  getPublicConfig,
  getSettings,
  invalidateSettingsCache,
} from "@/services/settings";

// 1x1 transparent PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02, 0xff, 0xd9]);

type AssetRow = { mime: string; dataBase64: string; updatedAt: Date };
const fake = {
  settingsRow: null as null | { data: unknown; updatedAt: Date },
  assets: {} as Record<string, AssetRow>,
  error: null as Error | null,
  queries: 0,
};

function rowsFor(table: unknown, cond: { value: unknown } | undefined) {
  fake.queries++;
  if (fake.error) throw fake.error;
  if (table === appSettings) return fake.settingsRow ? [fake.settingsRow] : [];
  if (table === brandingAssets) {
    if (cond) {
      const row = fake.assets[String(cond.value)];
      return row ? [row] : [];
    }
    return Object.entries(fake.assets).map(([kind, row]) => ({ kind, updatedAt: row.updatedAt }));
  }
  throw new Error("unexpected table");
}

(db.select as jest.Mock).mockImplementation(() => {
  let table: unknown;
  let cond: { value: unknown } | undefined;
  const builder = {
    from(t: unknown) {
      table = t;
      return builder;
    },
    where(c: { value: unknown }) {
      cond = c;
      return builder;
    },
    limit() {
      return builder;
    },
    then(resolve: (v: unknown) => void, reject: (e: unknown) => void) {
      try {
        resolve(rowsFor(table, cond));
      } catch (error) {
        reject(error);
      }
    },
  };
  return builder;
});

const ORIGINAL_ENV = { ...process.env };
let dir: string;
let now = 1_000_000;

function writeFile(rel: string, data: Buffer) {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), data);
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "settings-service-"));
  jest.spyOn(process, "cwd").mockReturnValue(dir);
  jest.spyOn(Date, "now").mockImplementation(() => now);
  jest.spyOn(console, "warn").mockImplementation(() => {});
  process.env = { ...ORIGINAL_ENV };
  for (const key of ["COMPANY_NAME", "COMPANY_NAME_LOCAL", "APP_NAME", "RESEND_API_KEY", "NEXT_PHASE", "APP_PASSWORD"]) {
    delete process.env[key];
  }
  fake.settingsRow = null;
  fake.assets = {};
  fake.error = null;
  fake.queries = 0;
  invalidateSettingsCache();
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
  process.env = ORIGINAL_ENV;
});

describe("getSettings", () => {
  it("falls back to env when app_settings has no row", async () => {
    process.env.COMPANY_NAME = "Env Co";
    const s = await getSettings();
    expect(s.company.name).toBe("Env Co");
    expect(s.company.isDefault).toBe(false);
  });

  it("layers the stored settings over env", async () => {
    process.env.COMPANY_NAME = "Env Co";
    process.env.COMPANY_ADDRESS = "Env St";
    fake.settingsRow = {
      data: { company: { name: "DB Co", address: "" }, appearance: { brandColor: "#000000" } },
      updatedAt: new Date("2026-10-09T00:00:00Z"),
    };
    const s = await getSettings();
    expect(s.company.name).toBe("DB Co");
    expect(s.company.address).toBe("");
    expect(s.appearance.brandColor).toBe("#000000");
  });

  it("caches for 15 s and reloads afterwards", async () => {
    await getSettings();
    const queries = fake.queries;
    await getSettings();
    now += SETTINGS_TTL_MS - 1;
    await getSettings();
    expect(fake.queries).toBe(queries);
    now += 2;
    fake.settingsRow = { data: { company: { name: "Later" } }, updatedAt: new Date() };
    expect((await getSettings()).company.name).toBe("Later");
    expect(fake.queries).toBeGreaterThan(queries);
  });

  it("reloads immediately after invalidateSettingsCache()", async () => {
    expect((await getSettings()).company.name).toBe("Your Company");
    fake.settingsRow = { data: { company: { name: "Saved" } }, updatedAt: new Date() };
    invalidateSettingsCache();
    expect((await getSettings()).company.name).toBe("Saved");
  });

  it("shares one load between concurrent callers", async () => {
    await Promise.all([getSettings(), getSettings(), getSettings()]);
    expect(fake.queries).toBe(2); // app_settings + branding stamps
  });

  it("uses env/defaults when the database is down, and warns", async () => {
    process.env.COMPANY_NAME = "Env Co";
    fake.error = new Error("ECONNREFUSED");
    const s = await getSettings();
    expect(s.company.name).toBe("Env Co");
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("ECONNREFUSED"));
  });

  it("keeps the last good settings through a database blip", async () => {
    fake.settingsRow = { data: { company: { name: "DB Co" } }, updatedAt: new Date() };
    await getSettings();
    now += SETTINGS_TTL_MS + 1;
    fake.error = new Error("ECONNRESET");
    expect((await getSettings()).company.name).toBe("DB Co");
  });

  it("never queries the database during next build", async () => {
    process.env.NEXT_PHASE = "phase-production-build";
    process.env.COMPANY_NAME = "Env Co";
    expect((await getSettings()).company.name).toBe("Env Co");
    expect(db.select).not.toHaveBeenCalled();
  });

  it("changes version when settings, uploads or branding files change", async () => {
    const v0 = (await getSettings()).version;
    const reload = async () => {
      invalidateSettingsCache();
      return (await getSettings()).version;
    };
    expect(await reload()).toBe(v0);

    fake.assets.logo = { mime: "image/png", dataBase64: PNG.toString("base64"), updatedAt: new Date("2026-10-09T01:00:00Z") };
    const v1 = await reload();
    expect(v1).not.toBe(v0);

    writeFile("branding/stamp.png", PNG);
    const v2 = await reload();
    expect(v2).not.toBe(v1);

    fake.settingsRow = { data: {}, updatedAt: new Date("2026-10-09T02:00:00Z") };
    expect(await reload()).not.toBe(v2);
  });
});

describe("getBrandingAsset — fallback order", () => {
  const dbRow = (data: Buffer, mime = "image/png") => ({
    mime,
    dataBase64: data.toString("base64"),
    updatedAt: new Date("2026-10-09T00:00:00Z"),
  });
  const marker = (label: string) => Buffer.concat([PNG, Buffer.from(label)]);

  it.each<[string, () => void, string | null]>([
    ["logo: default", () => writeFile("branding-defaults/logo.png", marker("default")), "default"],
    [
      "logo: disk over default",
      () => {
        writeFile("branding-defaults/logo.png", marker("default"));
        writeFile("branding/logo.png", marker("disk-logo"));
      },
      "disk-logo",
    ],
    [
      "logo: DB over disk",
      () => {
        writeFile("branding/logo.png", marker("disk-logo"));
        fake.assets.logo = dbRow(marker("db-logo"));
      },
      "db-logo",
    ],
    ["logo: nothing at all", () => {}, null],
  ])("%s", async (_label, arrange, expected) => {
    arrange();
    const asset = await getBrandingAsset("logo");
    expect(asset ? asset.data.subarray(PNG.length).toString() : null).toBe(expected);
  });

  it.each<[string, () => void, string]>([
    ["icon: DB icon first", () => { fake.assets.icon = dbRow(marker("db-icon")); writeFile("branding/icon.png", marker("disk-icon")); }, "db-icon"],
    ["icon: disk icon before any logo", () => { writeFile("branding/icon.png", marker("disk-icon")); fake.assets.logo = dbRow(marker("db-logo")); }, "disk-icon"],
    ["icon: then the DB logo", () => { fake.assets.logo = dbRow(marker("db-logo")); writeFile("branding/logo.png", marker("disk-logo")); }, "db-logo"],
    ["icon: then the disk logo", () => { writeFile("branding/logo.png", marker("disk-logo")); writeFile("branding-defaults/logo.png", marker("default")); }, "disk-logo"],
    ["icon: then the default logo", () => writeFile("branding-defaults/logo.png", marker("default")), "default"],
  ])("%s", async (_label, arrange, expected) => {
    writeFile("branding-defaults/logo.png", marker("default"));
    arrange();
    const asset = await getBrandingAsset("icon");
    expect(asset?.data.subarray(PNG.length).toString()).toBe(expected);
  });

  it("stamp: DB, then disk, never a default", async () => {
    writeFile("branding-defaults/logo.png", PNG);
    expect(await getBrandingAsset("stamp")).toBeNull();

    writeFile("branding/stamp.png", marker("disk-stamp"));
    invalidateSettingsCache();
    expect((await getBrandingAsset("stamp"))?.data.subarray(PNG.length).toString()).toBe("disk-stamp");

    fake.assets.stamp = dbRow(JPEG, "image/jpeg");
    invalidateSettingsCache();
    expect(await getBrandingAsset("stamp")).toMatchObject({ mime: "image/jpeg", data: JPEG });
  });

  it("falls through to disk when the database is down", async () => {
    writeFile("branding/logo.png", marker("disk-logo"));
    fake.error = new Error("ECONNREFUSED");
    expect((await getBrandingAsset("logo"))?.data.subarray(PNG.length).toString()).toBe("disk-logo");
  });

  it("detects the type of disk files by their bytes", async () => {
    writeFile("branding/logo.png", JPEG);
    expect((await getBrandingAsset("logo"))?.mime).toBe("image/jpeg");
  });

  it("has stable versions: content hash on disk, updatedAt in the DB", async () => {
    writeFile("branding/logo.png", PNG);
    const disk1 = await getBrandingAsset("logo");
    invalidateSettingsCache();
    const disk2 = await getBrandingAsset("logo");
    expect(disk1?.version).toBe(disk2?.version);
    expect(disk1?.version).toMatch(/^[0-9a-f]{16}$/);

    fake.assets.logo = dbRow(PNG);
    invalidateSettingsCache();
    const db1 = await getBrandingAsset("logo");
    fake.assets.logo = { ...dbRow(PNG), updatedAt: new Date("2026-10-10T00:00:00Z") };
    invalidateSettingsCache();
    const db2 = await getBrandingAsset("logo");
    expect(db1?.version).not.toBe(disk1?.version);
    expect(db2?.version).not.toBe(db1?.version);
  });

  it("never serves older image bytes than the current settings version announces", async () => {
    // /api/branding/logo?v=<settings.version> is cached as immutable, so the
    // bytes must be at least as new as that version (another replica may
    // have uploaded a logo; only the TTLs tell this process).
    fake.assets.logo = dbRow(marker("old"));
    await getSettings(); // t = 0: cached until 15 s
    now += 5_000;
    await getBrandingAsset("logo"); // t = 5 s: cached until 20 s
    fake.assets.logo = { ...dbRow(marker("new")), updatedAt: new Date("2026-10-10T00:00:00Z") };
    now += 11_000; // t = 16 s: the settings reload sees the new upload
    const before = (await getSettings()).version;
    const asset = await getBrandingAsset("logo");
    expect(asset?.data.subarray(PNG.length).toString()).toBe("new");
    expect((await getSettings()).version).toBe(before);
  });

  it("caches assets until invalidated", async () => {
    writeFile("branding/logo.png", marker("first"));
    await getBrandingAsset("logo");
    writeFile("branding/logo.png", marker("second"));
    expect((await getBrandingAsset("logo"))?.data.subarray(PNG.length).toString()).toBe("first");
    invalidateSettingsCache();
    expect((await getBrandingAsset("logo"))?.data.subarray(PNG.length).toString()).toBe("second");
  });
});

describe("getDocumentBranding", () => {
  beforeEach(() => writeFile("branding-defaults/logo.png", PNG));

  it("pdf mode inlines images as data URIs", async () => {
    fake.assets.stamp = { mime: "image/jpeg", dataBase64: JPEG.toString("base64"), updatedAt: new Date() };
    const b = await getDocumentBranding("pdf");
    expect(b.logoSrc).toBe(`data:image/png;base64,${PNG.toString("base64")}`);
    expect(b.stampSrc).toBe(`data:image/jpeg;base64,${JPEG.toString("base64")}`);
  });

  it("html mode links to versioned URLs; no stamp → null", async () => {
    const s = await getSettings();
    const b = await getDocumentBranding("html");
    expect(b.logoSrc).toBe(`/api/branding/logo?v=${s.version}`);
    expect(b.stampSrc).toBeNull();
    expect(b).toMatchObject({
      brandColor: "#1D4ED8",
      currency: "TWD",
      fractionDigits: 0,
      showAmountInWords: true,
      timezone: "Asia/Taipei",
      payment: null,
    });
  });
});

describe("getPublicConfig", () => {
  it.each<[string, Record<string, string>, unknown, string]>([
    ["defaults", {}, {}, "Quote System"],
    ["company name", { COMPANY_NAME: "Acme" }, {}, "Acme"],
    ["local name first", { COMPANY_NAME: "Acme" }, { company: { nameLocal: "頂尖" } }, "頂尖"],
    ["APP_NAME wins", { COMPANY_NAME: "Acme", APP_NAME: "Acme Quotes" }, {}, "Acme Quotes"],
  ])("appName: %s", async (_label, env, data, expected) => {
    Object.assign(process.env, env);
    fake.settingsRow = { data, updatedAt: new Date() };
    expect((await getPublicConfig()).appName).toBe(expected);
  });

  it("never exposes the Resend API key", async () => {
    process.env.RESEND_API_KEY = "re_secret_value";
    const pub = await getPublicConfig();
    expect(pub.mailEnabled).toBe(true);
    expect(JSON.stringify(pub)).not.toContain("re_secret_value");
    expect(pub.logoUrl).toBe(`/api/branding/logo?v=${pub.version}`);
    expect(pub.iconUrl).toBe(`/api/branding/icon?v=${pub.version}`);
  });
});
