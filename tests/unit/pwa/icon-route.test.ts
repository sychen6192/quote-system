const renderVersionedIcon = jest.fn();

jest.mock("@/lib/pwa/render-icon", () => ({
  renderVersionedIcon: (...args: unknown[]) => renderVersionedIcon(...args),
}));

import { GET, dynamic } from "@/app/icons/[file]/route";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

function get(file: string, query = "") {
  return GET(new Request(`http://localhost:3000/icons/${file}${query}`), {
    params: Promise.resolve({ file }),
  });
}

beforeEach(() => {
  renderVersionedIcon.mockResolvedValue({ png: PNG, version: "brand1" });
});

describe("GET /icons/[file]", () => {
  it("is dynamic", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("404s unknown files without caching", async () => {
    renderVersionedIcon.mockResolvedValueOnce(null);
    const res = await get("any-1024.png", "?v=brand1");
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("serves the PNG, cached forever under its own version", async () => {
    const res = await get("apple-180.png", "?v=brand1");
    expect(res.status).toBe(200);
    expect(renderVersionedIcon).toHaveBeenCalledWith("apple-180.png");
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("content-length")).toBe(String(PNG.byteLength));
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
  });

  it("does not pin another image under a ?v= it does not match", async () => {
    // e.g. the database is unreachable: the default logo is drawn while pages still link the branded version.
    renderVersionedIcon.mockResolvedValueOnce({ png: PNG, version: "default9" });
    const res = await get("apple-180.png", "?v=brand1");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("caches unversioned URLs for an hour", async () => {
    const res = await get("favicon-32.png");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
  });
});
