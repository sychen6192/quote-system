import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

type Env = Record<string, string | undefined>;

const DEFAULT_POOL_MAX = 10;

// docker --env-file keeps quotes literally; strip one layer like lib/config.ts.
function clean(raw: string | undefined): string {
  const v = (raw ?? "").trim();
  if (
    v.length >= 2 &&
    ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

export function resolveDatabaseUrl(env: Env = process.env): string {
  const url = clean(env.DATABASE_URL);
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Set it to your PostgreSQL connection string, " +
        "e.g. DATABASE_URL=postgres://user:password@host:5432/quote-system"
    );
  }
  return url;
}

export function resolvePoolMax(env: Env = process.env): number {
  const n = Number(clean(env.DB_POOL_MAX));
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : DEFAULT_POOL_MAX;
}

type Holder = { client: postgres.Sql; db: Database };

// One pool per process: survives dev HMR re-evaluation, and is shared by the
// separately bundled server layers (RSC pages, route handlers, actions).
const HOLDER = Symbol.for("quote-system.db");
const store = globalThis as { [HOLDER]?: Holder };

function holder(): Holder {
  let h = store[HOLDER];
  if (!h) {
    // Created on first use, not on import: `next build` imports this module
    // without a database (or DATABASE_URL) being available.
    const client = postgres(resolveDatabaseUrl(), {
      max: resolvePoolMax(),
      idle_timeout: 30,
      connect_timeout: 10,
      onnotice: () => {},
    });
    h = { client, db: drizzle(client, { schema }) };
    store[HOLDER] = h;
  }
  return h;
}

export function getDb(): Database {
  return holder().db;
}

/** Closes the pool (scripts/tests); the next query opens a fresh one. */
export async function closeDb(): Promise<void> {
  const h = store[HOLDER];
  if (!h) return;
  store[HOLDER] = undefined;
  await h.client.end({ timeout: 5 });
}

export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    const real = getDb();
    const value: unknown = Reflect.get(real, prop, real);
    // Methods rely on `this`; the constructor must stay unbound so drizzle's
    // is()/entityKind checks still see its static fields.
    return typeof value === "function" && prop !== "constructor" ? value.bind(real) : value;
  },
  has(_target, prop) {
    return Reflect.has(getDb(), prop);
  },
  getPrototypeOf() {
    return Object.getPrototypeOf(getDb());
  },
});
