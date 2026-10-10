type Call = string;

const calls: Call[] = [];
let selectFailures: unknown[] = [];

// Tagged-template stand-in for a postgres.js client.
const sql = Object.assign(
  jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?").trim();
    calls.push(`${text}${values.length ? ` [${values.join(",")}]` : ""}`);
    if (text === "select 1" && selectFailures.length) throw selectFailures.shift();
    return [];
  }),
  { end: jest.fn(async () => void calls.push("end")) }
);
const postgresMock = jest.fn<typeof sql, unknown[]>(() => sql);
jest.mock("postgres", () => ({ __esModule: true, default: postgresMock }));
jest.mock("drizzle-orm/postgres-js", () => ({ drizzle: jest.fn(() => ({ kind: "db" })) }));
const migrate = jest.fn<Promise<void>, unknown[]>(async () => void calls.push("migrate"));
jest.mock("drizzle-orm/postgres-js/migrator", () => ({ migrate }));

import {
  MIGRATION_LOCK_KEY,
  isTransientDbError,
  migrateOnBoot,
  migrationsSkipped,
  runMigrations,
} from "@/lib/db/migrate";

const ORIGINAL = { ...process.env };
const err = (code: string) => Object.assign(new Error(code), { code });

let log: jest.SpyInstance;
let error: jest.SpyInstance;
beforeEach(() => {
  calls.length = 0;
  selectFailures = [];
  migrate.mockClear();
  postgresMock.mockClear();
  process.env = { ...ORIGINAL, DATABASE_URL: "postgres://u:p@db:5432/app" };
  delete process.env.SKIP_DB_MIGRATIONS;
  log = jest.spyOn(console, "log").mockImplementation(() => {});
  error = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  log.mockRestore();
  error.mockRestore();
});
afterAll(() => {
  process.env = ORIGINAL;
});

describe("runMigrations", () => {
  it("migrates under a session advisory lock on a single dedicated connection", async () => {
    await runMigrations({ migrationsFolder: "/app/drizzle" });

    expect(postgresMock).toHaveBeenCalledWith(
      "postgres://u:p@db:5432/app",
      expect.objectContaining({ max: 1, connection: expect.objectContaining({ TimeZone: "UTC" }) })
    );
    expect(calls).toEqual([
      "select 1",
      `select pg_advisory_lock(?) [${MIGRATION_LOCK_KEY}]`,
      "migrate",
      `select pg_advisory_unlock(?) [${MIGRATION_LOCK_KEY}]`,
      "end",
    ]);
    expect(migrate).toHaveBeenCalledWith({ kind: "db" }, { migrationsFolder: "/app/drizzle" });
  });

  it("defaults to ./drizzle under the working directory", async () => {
    await runMigrations();
    expect(migrate.mock.calls[0][1]).toEqual({ migrationsFolder: `${process.cwd()}/drizzle` });
  });

  it("waits for a database that is still starting", async () => {
    selectFailures = [err("ECONNREFUSED"), err("57P03")];
    await runMigrations({ retryDelayMs: 0 });
    expect(calls.filter((c) => c === "select 1")).toHaveLength(3);
    expect(migrate).toHaveBeenCalledTimes(1);
  });

  it("fails fast on a non-transient error (bad password)", async () => {
    selectFailures = [err("28P01")];
    await expect(runMigrations({ retryDelayMs: 0 })).rejects.toThrow("28P01");
    expect(calls).toEqual(["select 1", "end"]);
    expect(migrate).not.toHaveBeenCalled();
  });

  it("gives up after the configured attempts", async () => {
    selectFailures = Array.from({ length: 5 }, () => err("ECONNREFUSED"));
    await expect(runMigrations({ attempts: 3, retryDelayMs: 0 })).rejects.toThrow("ECONNREFUSED");
    expect(calls.filter((c) => c === "select 1")).toHaveLength(3);
    expect(calls.at(-1)).toBe("end");
  });

  it("releases the lock and closes the client when a migration fails", async () => {
    migrate.mockImplementationOnce(async () => {
      throw new Error("syntax error");
    });
    await expect(runMigrations()).rejects.toThrow("syntax error");
    expect(calls).toEqual([
      "select 1",
      `select pg_advisory_lock(?) [${MIGRATION_LOCK_KEY}]`,
      `select pg_advisory_unlock(?) [${MIGRATION_LOCK_KEY}]`,
      "end",
    ]);
  });

  it("explains a missing DATABASE_URL", async () => {
    delete process.env.DATABASE_URL;
    await expect(runMigrations()).rejects.toThrow(/DATABASE_URL is not set/);
    expect(postgresMock).not.toHaveBeenCalled();
  });
});

describe("isTransientDbError", () => {
  it("looks at codes, aggregate errors and causes", () => {
    expect(isTransientDbError(err("ECONNREFUSED"))).toBe(true);
    expect(isTransientDbError(err("CONNECT_TIMEOUT"))).toBe(true);
    expect(isTransientDbError(new AggregateError([err("ECONNREFUSED")]))).toBe(true);
    expect(isTransientDbError(new Error("x", { cause: err("ENOTFOUND") }))).toBe(true);
    expect(isTransientDbError(err("28P01"))).toBe(false);
    expect(isTransientDbError(err("3D000"))).toBe(false);
    expect(isTransientDbError(new Error("plain"))).toBe(false);
    expect(isTransientDbError(null)).toBe(false);
  });
});

describe("migrateOnBoot", () => {
  let exit: jest.SpyInstance;
  beforeEach(() => {
    exit = jest.spyOn(process, "exit").mockImplementation((() => undefined) as never);
  });
  afterEach(() => exit.mockRestore());

  it("runs the migrations", async () => {
    await migrateOnBoot();
    expect(migrate).toHaveBeenCalledTimes(1);
    expect(exit).not.toHaveBeenCalled();
  });

  it("exits with 1 so the container restarts instead of serving a broken app", async () => {
    selectFailures = [err("3D000")];
    await migrateOnBoot();
    expect(exit).toHaveBeenCalledWith(1);
    expect(error).toHaveBeenCalled();
  });

  it("can be skipped", async () => {
    process.env.SKIP_DB_MIGRATIONS = "true";
    await migrateOnBoot();
    expect(postgresMock).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it.each([
    ["true", true],
    ["TRUE", true],
    ['"true"', true],
    ["1", true],
    ["yes", true],
    ["", false],
    ["false", false],
    ["0", false],
    [undefined, false],
  ])("SKIP_DB_MIGRATIONS=%p → skipped=%p", (value, expected) => {
    expect(migrationsSkipped({ SKIP_DB_MIGRATIONS: value })).toBe(expected);
  });
});
