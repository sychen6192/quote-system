import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { resolveDatabaseUrl } from "@/db";

// Arbitrary app-specific key; every replica must use the same one.
export const MIGRATION_LOCK_KEY = 4_211_993_001;

// Worth waiting for: the DB container is still booting, DNS is not up yet.
// Not worth waiting for: bad password (28P01), unknown database (3D000), SQL errors.
const TRANSIENT_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "CONNECT_TIMEOUT",
  "CONNECTION_CLOSED",
  "CONNECTION_ENDED",
  "CONNECTION_DESTROYED",
  "57P03", // cannot_connect_now: server starting up
  "57P01", // admin_shutdown: server restarting
  "53300", // too_many_connections
]);

type ErrorLike = { code?: unknown; errors?: unknown; cause?: unknown };

export function isTransientDbError(err: unknown, depth = 0): boolean {
  if (!err || typeof err !== "object" || depth > 3) return false;
  const e = err as ErrorLike;
  if (typeof e.code === "string" && TRANSIENT_CODES.has(e.code)) return true;
  // Happy-eyeballs connects (localhost → ::1 and 127.0.0.1) fail with an AggregateError.
  if (Array.isArray(e.errors) && e.errors.some((x) => isTransientDbError(x, depth + 1))) return true;
  return isTransientDbError(e.cause, depth + 1);
}

export type RunMigrationsOptions = {
  url?: string;
  migrationsFolder?: string;
  /** Connection attempts before giving up on a transient error. */
  attempts?: number;
  retryDelayMs?: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runMigrations({
  url = resolveDatabaseUrl(),
  // Standalone server.js chdirs to its own folder, where the image ships drizzle/.
  migrationsFolder = path.join(process.cwd(), "drizzle"),
  attempts = 30,
  retryDelayMs = 2000,
}: RunMigrationsOptions = {}): Promise<void> {
  // A dedicated single-connection client: the session-level advisory lock and
  // every migration statement must share one backend session.
  // TimeZone: migrations run now()/defaults too (see db/index.ts).
  const sql = postgres(url, {
    max: 1,
    onnotice: () => {},
    connect_timeout: 10,
    connection: { TimeZone: "UTC" },
  });
  try {
    for (let attempt = 1; ; attempt++) {
      try {
        await sql`select 1`;
        break;
      } catch (err) {
        if (attempt >= attempts || !isTransientDbError(err)) throw err;
        console.log(
          `[migrate] database not reachable (attempt ${attempt}/${attempts}), retrying in ${retryDelayMs / 1000}s`
        );
        await sleep(retryDelayMs);
      }
    }

    const started = Date.now();
    // drizzle runs its schema/table DDL outside its own transaction, so two
    // replicas booting together would race without this lock.
    await sql`select pg_advisory_lock(${MIGRATION_LOCK_KEY})`;
    try {
      await migrate(drizzle(sql), { migrationsFolder });
    } finally {
      await sql`select pg_advisory_unlock(${MIGRATION_LOCK_KEY})`;
    }
    console.log(`[migrate] schema up to date (${Date.now() - started} ms)`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export function migrationsSkipped(env: Record<string, string | undefined> = process.env): boolean {
  const v = (env.SKIP_DB_MIGRATIONS ?? "").trim().replace(/^(["'])(.*)\1$/, "$2").toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

/** Called from instrumentation.ts register(): once per server start. */
export async function migrateOnBoot(): Promise<void> {
  if (migrationsSkipped()) {
    console.log("[migrate] skipped (SKIP_DB_MIGRATIONS is set)");
    return;
  }
  try {
    await runMigrations();
  } catch (err) {
    console.error("[migrate] failed; refusing to serve with an unknown schema:", err);
    // If register() threw instead, Next would keep listening and every request
    // would await the rejected prepare() promise. Exit so Docker restarts us.
    process.exit(1);
  }
}
