const end = jest.fn(async () => {});
const fakeClient = { end };
const postgresMock = jest.fn<typeof fakeClient, unknown[]>(() => fakeClient);
jest.mock("postgres", () => ({ __esModule: true, default: postgresMock }));

class FakeDb {
  marker = "real-db";
  select() {
    return this.marker;
  }
}
const drizzleMock = jest.fn<FakeDb, unknown[]>(() => new FakeDb());
jest.mock("drizzle-orm/postgres-js", () => ({ drizzle: drizzleMock }));

import type * as DbModule from "@/db";

const HOLDER = Symbol.for("quote-system.db");
const ORIGINAL = { ...process.env };

function load(): typeof DbModule {
  let mod!: typeof DbModule;
  jest.isolateModules(() => {
    mod = jest.requireActual("@/db");
  });
  return mod;
}

beforeEach(() => {
  delete (globalThis as { [HOLDER]?: unknown })[HOLDER];
  postgresMock.mockClear();
  drizzleMock.mockClear();
  end.mockClear();
  process.env = { ...ORIGINAL, DATABASE_URL: "postgres://u:p@db:5432/app" };
  delete process.env.DB_POOL_MAX;
});
afterAll(() => {
  process.env = ORIGINAL;
  delete (globalThis as { [HOLDER]?: unknown })[HOLDER];
});

describe("db (lazy pool)", () => {
  it("does not connect on import, even without DATABASE_URL (next build)", () => {
    delete process.env.DATABASE_URL;
    expect(() => load()).not.toThrow();
    expect(postgresMock).not.toHaveBeenCalled();
  });

  it("creates the pool on first use with the configured options", () => {
    const { db } = load();
    expect(postgresMock).not.toHaveBeenCalled();
    expect(db.select()).toBe("real-db"); // methods stay bound to the real instance
    expect(postgresMock).toHaveBeenCalledTimes(1);
    expect(postgresMock).toHaveBeenCalledWith(
      "postgres://u:p@db:5432/app",
      expect.objectContaining({ max: 10, idle_timeout: expect.any(Number) })
    );
    expect(db).toBeInstanceOf(FakeDb);
  });

  // Columns are `timestamp without time zone` read back as UTC: now() and
  // defaultNow() must run in UTC whatever the server's TimeZone is.
  it("pins the session time zone to UTC", () => {
    load().getDb();
    expect(postgresMock).toHaveBeenCalledWith(
      "postgres://u:p@db:5432/app",
      expect.objectContaining({ connection: expect.objectContaining({ TimeZone: "UTC" }) })
    );
  });

  it("strips one layer of quotes from DATABASE_URL and honours DB_POOL_MAX", () => {
    process.env.DATABASE_URL = ` "postgres://u:p@db:5432/app" `;
    process.env.DB_POOL_MAX = "4";
    load().getDb();
    expect(postgresMock).toHaveBeenCalledWith("postgres://u:p@db:5432/app", expect.objectContaining({ max: 4 }));
  });

  it("fails with a clear message when DATABASE_URL is missing", () => {
    delete process.env.DATABASE_URL;
    const { db } = load();
    expect(() => db.select()).toThrow(/DATABASE_URL is not set/);
  });

  it("keeps one pool per process across module instances (dev HMR, server layers)", () => {
    load().getDb();
    load().getDb();
    expect(postgresMock).toHaveBeenCalledTimes(1);
  });

  it("closeDb() ends the pool and lets the next query reopen it", async () => {
    const mod = load();
    mod.getDb();
    await mod.closeDb();
    expect(end).toHaveBeenCalledTimes(1);
    mod.getDb();
    expect(postgresMock).toHaveBeenCalledTimes(2);
  });
});

describe("resolvePoolMax / resolveDatabaseUrl", () => {
  it.each([
    [undefined, 10],
    ["", 10],
    ["1", 1],
    ["25", 25],
    ["'7'", 7],
    ["0", 10],
    ["-3", 10],
    ["2.5", 10],
    ["lots", 10],
    ["1000", 10],
  ])("DB_POOL_MAX=%p → %p", (raw, expected) => {
    expect(load().resolvePoolMax({ DB_POOL_MAX: raw })).toBe(expected);
  });

  it("resolves or explains the URL", () => {
    const { resolveDatabaseUrl } = load();
    expect(resolveDatabaseUrl({ DATABASE_URL: "'postgres://x'" })).toBe("postgres://x");
    expect(() => resolveDatabaseUrl({})).toThrow(/DATABASE_URL is not set/);
    expect(() => resolveDatabaseUrl({ DATABASE_URL: '""' })).toThrow(/DATABASE_URL is not set/);
  });
});
