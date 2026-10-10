jest.mock("@/services/settings", () => ({
  getBrandingAsset: jest.fn(),
  getSettings: jest.fn(),
}));
jest.mock("@/lib/auth/guard", () => ({ isAuthenticated: jest.fn() }));

import { GET as brandingGET, dynamic } from "@/app/api/branding/[kind]/route";
import { GET as iconAliasGET } from "@/app/api/branding-icon/route";
import { isAuthenticated } from "@/lib/auth/guard";
import {
  BRANDING_IMMUTABLE,
  BRANDING_PRIVATE_IMMUTABLE,
  BRANDING_PRIVATE_SHORT_CACHE,
  BRANDING_SHORT_CACHE,
} from "@/lib/settings/branding-response";
import { getBrandingAsset, getSettings } from "@/services/settings";

const mockAsset = getBrandingAsset as jest.Mock;
const mockSettings = getSettings as jest.Mock;
const mockIsAuthenticated = isAuthenticated as jest.Mock;

const BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const ASSET = { data: BYTES, mime: "image/png", version: "assetv1" };
const BASE = "http://localhost:3000";

function get(kind: string, query = "", headers: Record<string, string> = {}) {
  return brandingGET(new Request(`${BASE}/api/branding/${kind}${query}`, { headers }), {
    params: Promise.resolve({ kind }),
  });
}

beforeEach(() => {
  mockAsset.mockResolvedValue(ASSET);
  mockSettings.mockResolvedValue({ version: "settingsv1" });
  mockIsAuthenticated.mockResolvedValue(true);
});

describe("GET /api/branding/[kind]", () => {
  it("is dynamic", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it.each(["favicon", "LOGO", "..", "logo.png"])("404s for unknown kind %p", async (kind) => {
    const res = await get(kind);
    expect(res.status).toBe(404);
    expect(mockAsset).not.toHaveBeenCalled();
  });

  it("404s when there is no asset (no stamp configured)", async () => {
    mockAsset.mockResolvedValueOnce(null);
    const res = await get("stamp");
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it.each(["logo", "stamp", "icon"])("serves %s with its type, length and ETag", async (kind) => {
    const res = await get(kind);
    expect(res.status).toBe(200);
    expect(mockAsset).toHaveBeenCalledWith(kind);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("content-length")).toBe(String(BYTES.length));
    expect(res.headers.get("etag")).toBe('"assetv1"');
    expect(Buffer.from(await res.arrayBuffer())).toEqual(BYTES);
  });

  it("serves JPEG uploads as image/jpeg", async () => {
    mockAsset.mockResolvedValueOnce({ ...ASSET, mime: "image/jpeg" });
    expect((await get("logo")).headers.get("content-type")).toBe("image/jpeg");
  });

  it.each<[string, string]>([
    ["", BRANDING_SHORT_CACHE],
    ["?v=settingsv1", BRANDING_IMMUTABLE],
    ["?v=assetv1", BRANDING_IMMUTABLE],
    ["?v=stale-or-future", BRANDING_SHORT_CACHE],
    ["?v=", BRANDING_SHORT_CACHE],
  ])("query %p → Cache-Control %p", async (query, expected) => {
    expect((await get("logo", query)).headers.get("cache-control")).toBe(expected);
  });

  it("reads the settings version before the image (bytes never older than ?v=)", async () => {
    await get("logo", "?v=settingsv1");
    expect(mockSettings.mock.invocationCallOrder[0]).toBeLessThan(
      mockAsset.mock.invocationCallOrder[0]
    );
  });

  describe("stamp (company seal)", () => {
    it("401s without a session and reads nothing", async () => {
      mockIsAuthenticated.mockResolvedValue(false);
      const res = await get("stamp", "?v=settingsv1");
      expect(res.status).toBe(401);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(mockAsset).not.toHaveBeenCalled();
    });

    it.each<[string, string]>([
      ["", BRANDING_PRIVATE_SHORT_CACHE],
      ["?v=settingsv1", BRANDING_PRIVATE_IMMUTABLE],
      ["?v=old", BRANDING_PRIVATE_SHORT_CACHE],
    ])("is never cached by shared caches (query %p)", async (query, expected) => {
      const res = await get("stamp", query);
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe(expected);
    });

    it.each(["logo", "icon"])("%s stays public without a session", async (kind) => {
      mockIsAuthenticated.mockResolvedValue(false);
      const res = await get(kind, "?v=settingsv1");
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe(BRANDING_IMMUTABLE);
      expect(mockIsAuthenticated).not.toHaveBeenCalled();
    });
  });

  it("uses the documented header values", () => {
    expect(BRANDING_IMMUTABLE).toBe("public, max-age=31536000, immutable");
    expect(BRANDING_SHORT_CACHE).toBe("public, max-age=300");
  });

  it.each(['"assetv1"', 'W/"assetv1"', '"other", "assetv1"', "*"])(
    "answers 304 for If-None-Match %s",
    async (inm) => {
      const res = await get("logo", "?v=settingsv1", { "if-none-match": inm });
      expect(res.status).toBe(304);
      expect(res.headers.get("etag")).toBe('"assetv1"');
      expect(res.headers.get("cache-control")).toBe(BRANDING_IMMUTABLE);
      expect(await res.text()).toBe("");
    }
  );

  it("answers 200 when the ETag differs", async () => {
    const res = await get("logo", "", { "if-none-match": '"assetv0"' });
    expect(res.status).toBe(200);
  });
});

describe("GET /api/branding-icon (alias)", () => {
  it("serves the icon asset", async () => {
    const res = await iconAliasGET(new Request(`${BASE}/api/branding-icon?v=settingsv1`));
    expect(mockAsset).toHaveBeenCalledWith("icon");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(BRANDING_IMMUTABLE);
    expect(res.headers.get("etag")).toBe('"assetv1"');
  });
});
