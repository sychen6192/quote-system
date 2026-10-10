jest.mock("@/db", () => ({ db: { insert: jest.fn(), delete: jest.fn() } }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/auth/guard", () => ({
  assertAuthenticated: jest.fn(),
  isUnauthenticatedError: (e: unknown) => e instanceof Error && e.message === "UNAUTHENTICATED",
}));
jest.mock("@/services/settings", () => ({ invalidateSettingsCache: jest.fn() }));

import { revalidatePath } from "next/cache";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { deleteBrandingAsset, saveSettings, uploadBrandingAsset } from "@/actions/settings";
import { db } from "@/db";
import { assertAuthenticated } from "@/lib/auth/guard";
import { MAX_BRANDING_BYTES } from "@/lib/settings/branding";
import type { SettingsSection } from "@/lib/settings/schema";
import { invalidateSettingsCache } from "@/services/settings";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);
const JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x02, 0x00, 0x03, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11,
  0x01, 0x03, 0x11, 0x01, 0xff, 0xd9,
]);

// Header of an 8192 × 8192 PNG (the pixel data does not matter here).
const hugePng = Buffer.from(PNG);
hugePng.writeUInt32BE(8192, 16);
hugePng.writeUInt32BE(8192, 20);

const mockAuth = assertAuthenticated as jest.Mock;
const mockInsert = db.insert as jest.Mock;
const mockDelete = db.delete as jest.Mock;

type Chain = { method: string; args: unknown[] }[];
let chains: Chain[];
let failWith: Error | null;

function builder() {
  const chain: Chain = [];
  chains.push(chain);
  const proxy: object = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
            failWith ? reject(failWith) : resolve([]);
        }
        return (...args: unknown[]) => {
          chain.push({ method: String(prop), args });
          return proxy;
        };
      },
    }
  );
  return proxy;
}

const argOf = (chain: Chain, method: string) => chain.find((c) => c.method === method)?.args[0];

function form(fields: Record<string, string | Blob>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

beforeEach(() => {
  chains = [];
  failWith = null;
  mockAuth.mockResolvedValue(undefined);
  mockInsert.mockImplementation((...args: unknown[]) => {
    const b = builder();
    chains[chains.length - 1].push({ method: "insert", args });
    return b;
  });
  mockDelete.mockImplementation((...args: unknown[]) => {
    const b = builder();
    chains[chains.length - 1].push({ method: "delete", args });
    return b;
  });
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe.each<[string, () => Promise<unknown>]>([
  ["saveSettings", () => saveSettings("company", { name: "Acme" })],
  ["uploadBrandingAsset", () => uploadBrandingAsset(form({ kind: "logo", file: new Blob([PNG]) }))],
  ["deleteBrandingAsset", () => deleteBrandingAsset("logo")],
])("%s", (_name, call) => {
  it("returns UNAUTHORIZED before touching the database", async () => {
    mockAuth.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    await expect(call()).resolves.toMatchObject({ success: false, code: "UNAUTHORIZED" });
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(invalidateSettingsCache).not.toHaveBeenCalled();
  });

  it("returns INTERNAL (no raw DB text) when the write fails", async () => {
    failWith = new Error('relation "app_settings" does not exist');
    const result = await call();
    expect(result).toEqual({ success: false, code: "INTERNAL", message: expect.any(String) });
    expect(JSON.stringify(result)).not.toContain("relation");
    expect(invalidateSettingsCache).not.toHaveBeenCalled();
  });

  it("invalidates the settings cache and revalidates every page on success", async () => {
    await expect(call()).resolves.toEqual({ success: true });
    expect(invalidateSettingsCache).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/[locale]", "layout");
  });
});

describe("saveSettings", () => {
  it("rejects an unknown section", async () => {
    await expect(saveSettings("auth" as SettingsSection, {})).resolves.toEqual({
      success: false,
      code: "VALIDATION",
      fieldErrors: { section: ["invalidValue"] },
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns field errors as Validation keys", async () => {
    await expect(
      saveSettings("appearance", { brandColor: "red" })
    ).resolves.toEqual({
      success: false,
      code: "VALIDATION",
      fieldErrors: { brandColor: ["invalidColor"] },
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("upserts row 1, merging the validated patch in SQL", async () => {
    await saveSettings("company", { name: " Acme ", address: null, apiKey: "ignored" });
    const [chain] = chains;
    const values = argOf(chain, "values") as { id: number };
    expect(values.id).toBe(1);
    const conflict = argOf(chain, "onConflictDoUpdate") as { set: Record<string, unknown> };
    expect(Object.keys(conflict.set).sort()).toEqual(["data", "updatedAt"]);

    // The patch and the removed keys travel as bound parameters.
    const query = new PgDialect().sqlToQuery(conflict.set.data as SQL);
    expect(query.params).toEqual(
      expect.arrayContaining(["company", JSON.stringify({ name: "Acme" }), '{"address"}'])
    );
    expect(query.sql).toContain('"app_settings"."data"');
    expect(JSON.stringify(query.params)).not.toContain("ignored");
  });
});

describe("uploadBrandingAsset", () => {
  it.each<[string, Record<string, string | Blob>, Record<string, string[]>]>([
    ["unknown kind", { kind: "favicon", file: new Blob([PNG]) }, { kind: ["invalidValue"] }],
    ["missing kind", { file: new Blob([PNG]) }, { kind: ["invalidValue"] }],
    ["missing file", { kind: "logo" }, { file: ["required"] }],
    ["file as text", { kind: "logo", file: "not a file" }, { file: ["required"] }],
    ["empty file", { kind: "logo", file: new Blob([]) }, { file: ["required"] }],
    [
      "over 1 MB",
      { kind: "logo", file: new Blob([PNG, new Uint8Array(MAX_BRANDING_BYTES)]) },
      { file: ["imageTooLarge"] },
    ],
    ["a huge PNG", { kind: "logo", file: new Blob([hugePng]) }, { file: ["imageDimensionsTooLarge"] }],
    ["SVG", { kind: "logo", file: new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: "image/png" }) }, { file: ["unsupportedImage"] }],
    ["GIF", { kind: "stamp", file: new Blob([Buffer.from("GIF89a\x01\x00\x01\x00", "binary")]) }, { file: ["unsupportedImage"] }],
  ])("rejects %s", async (_label, fields, fieldErrors) => {
    await expect(uploadBrandingAsset(form(fields))).resolves.toEqual({
      success: false,
      code: "VALIDATION",
      fieldErrors,
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it.each<[string, Buffer<ArrayBuffer>, string]>([
    ["PNG", PNG, "image/png"],
    ["JPEG (even when named .png)", JPEG, "image/jpeg"],
  ])("stores a %s as base64 with the sniffed type", async (_label, bytes, mime) => {
    const file = new File([bytes], "logo.png", { type: "image/png" });
    await expect(uploadBrandingAsset(form({ kind: "stamp", file }))).resolves.toEqual({ success: true });
    const [chain] = chains;
    expect(argOf(chain, "values")).toMatchObject({
      kind: "stamp",
      mime,
      dataBase64: bytes.toString("base64"),
    });
    expect(argOf(chain, "onConflictDoUpdate")).toMatchObject({
      set: { mime, dataBase64: bytes.toString("base64") },
    });
  });

  it.each<[string, unknown]>([
    ["a plain object", { kind: "logo", file: "x" }],
    ["a string", "logo"],
    ["null", null],
  ])("rejects %s instead of FormData (actions are public endpoints)", async (_label, payload) => {
    await expect(uploadBrandingAsset(payload as FormData)).resolves.toEqual({
      success: false,
      code: "VALIDATION",
      fieldErrors: { file: ["required"] },
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("accepts exactly 1 MB", async () => {
    const big = Buffer.alloc(MAX_BRANDING_BYTES);
    PNG.copy(big);
    await expect(uploadBrandingAsset(form({ kind: "logo", file: new Blob([big]) }))).resolves.toEqual({
      success: true,
    });
  });
});

describe("deleteBrandingAsset", () => {
  it("rejects an unknown kind", async () => {
    await expect(deleteBrandingAsset("banner" as "logo")).resolves.toEqual({
      success: false,
      code: "VALIDATION",
      fieldErrors: { kind: ["invalidValue"] },
    });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("deletes the row for that kind", async () => {
    await deleteBrandingAsset("icon");
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(argOf(chains[0], "where")).toBeDefined();
  });
});
