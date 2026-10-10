// Restore drill: runs the restore commands from docs/deploy/backup.md (the
// part inside `docker compose exec -T db sh -c '...'`) against a real
// PostgreSQL, the way they run inside the db container, and then starts the
// migrator of a *newer* release on the result. The old recipe
// (`pg_restore --clean --if-exists` into the live database) left that newer
// release's tables behind, so its next migration failed and the app
// restart-looped.
//
// Needs TEST_DATABASE_URL (only its server is used: the drill creates and drops
// its own <name>_restore_src / <name>_restore_dst databases) and the PostgreSQL
// client tools (pg_dump, pg_restore, dropdb, createdb) on PATH.
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/quote_test npx jest tests/unit/packaging/restore-drill
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import postgres from "postgres";
import { runMigrations } from "@/lib/db/migrate";

const ROOT = path.join(__dirname, "..", "..", "..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

/** The `sh -c '...'` scripts of the documented restore, in order, with their stdin redirect. */
function restoreScripts(file: string, heading: RegExp): { script: string; stdin: string | null }[] {
  const text = read(file);
  const start = text.search(heading);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = text.indexOf("\n## ", start + 1);
  const section = text.slice(start, end === -1 ? undefined : end);
  const block = /```sh\n([\s\S]*?)```/.exec(section)?.[1] ?? "";
  return block
    .split("\n")
    .map((line) => /^docker compose exec -T db sh -c '([^']+)'(?: < (\S+))?$/.exec(line.trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ script: m[1], stdin: m[2] ?? null }));
}

describe("documented restore commands", () => {
  const reference = restoreScripts("docs/deploy/backup.md", /^## Restore$/m);

  it("drop and recreate the database, then restore and stop at the first error", () => {
    expect(reference).toHaveLength(2);
    expect(reference[0].script).toMatch(/dropdb .*--force/);
    expect(reference[0].script).toMatch(/createdb /);
    expect(reference[1].script).toMatch(/^pg_restore .*--exit-on-error/);
    expect(reference[1].stdin).toMatch(/\.dump$/);
  });

  it.each([
    ["docs/deploy/backup.zh-TW.md", /^## 還原$/m],
    ["README.md", /^\*\*Restore\*\*/m],
    ["README.zh-TW.md", /^\*\*還原\*\*/m],
  ])("%s uses the same commands", (file, heading) => {
    expect(restoreScripts(file, heading)).toEqual(reference);
  });

  it("the compose file's footer uses the same commands", () => {
    const footer = read("deploy/docker-compose.yml")
      .split("\n")
      .filter((l) => l.startsWith("#   docker compose exec -T db sh -c") && !l.includes("pg_dump"))
      .map((l) => /sh -c '([^']+)'/.exec(l)?.[1]);
    expect(footer).toEqual(reference.map((r) => r.script));
  });
});

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

function toolMajor(tool: string): number {
  const res = spawnSync(tool, ["--version"], { encoding: "utf8" });
  return res.status === 0 ? Number(/(\d+)(\.\d+)?/.exec(res.stdout)?.[1] ?? 0) : 0;
}
// pg_dump refuses servers newer than itself; the CI image and this repo use 16.
const TOOLS_OK = ["pg_dump", "pg_restore", "dropdb", "createdb"].every((t) => toolMajor(t) >= 16);
const describeDrill = TEST_DATABASE_URL && TOOLS_OK ? describe : describe.skip;

if (process.env.CI && TEST_DATABASE_URL && !TOOLS_OK) {
  // CI installs them (pipeline.yml, "PostgreSQL client tools"): never skip there.
  it("has the PostgreSQL 16+ client tools for the restore drill", () => {
    throw new Error("pg_dump, pg_restore, dropdb and createdb (16 or newer) must be on PATH");
  });
}

describeDrill("restore drill against PostgreSQL", () => {
  const server = new URL(TEST_DATABASE_URL ?? "postgres://localhost/x");
  const base = decodeURIComponent(server.pathname.slice(1)).replace(/[^A-Za-z0-9_]/g, "_");
  const SRC = `${base}_restore_src`;
  const DST = `${base}_restore_dst`;
  const urlOf = (db: string) => Object.assign(new URL(server.href), { pathname: `/${db}` }).href;
  const admin = postgres(urlOf("postgres"), { max: 1, onnotice: () => {} });
  // What the commands see inside the db container, plus how to reach this server.
  const user = decodeURIComponent(server.username) || "postgres";
  const env = {
    ...process.env,
    POSTGRES_USER: user,
    POSTGRES_DB: DST,
    PGUSER: user,
    PGHOST: server.hostname,
    PGPORT: server.port || "5432",
    PGPASSWORD: decodeURIComponent(server.password),
  };
  let tmp: string;

  async function dropAll() {
    for (const db of [SRC, DST]) await admin.unsafe(`drop database if exists "${db}" with (force)`);
  }

  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "restore-drill-"));
    await dropAll();
  });
  afterAll(async () => {
    await dropAll();
    await admin.end({ timeout: 5 });
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  /** drizzle/ plus one synthetic later migration whose table references quotations. */
  function newerRelease(): string {
    const folder = path.join(tmp, "drizzle-next");
    fs.cpSync(path.join(ROOT, "drizzle"), folder, { recursive: true });
    const journalFile = path.join(folder, "meta", "_journal.json");
    const journal = JSON.parse(fs.readFileSync(journalFile, "utf8"));
    const last = journal.entries[journal.entries.length - 1];
    const tag = `${String(last.idx + 1).padStart(4, "0")}_restore_drill`;
    journal.entries.push({ ...last, idx: last.idx + 1, when: last.when + 1000, tag });
    fs.writeFileSync(journalFile, JSON.stringify(journal, null, 2));
    fs.writeFileSync(
      path.join(folder, `${tag}.sql`),
      `CREATE TABLE "drill_invoices" ("id" serial PRIMARY KEY NOT NULL, "quote_id" integer REFERENCES "quotations"("id"));`,
    );
    return folder;
  }

  it("a dump from an older release restores over a newer one, and the newer release starts on it", async () => {
    // 1. The old server: this release's schema with a quote in it, dumped.
    await admin.unsafe(`create database "${SRC}"`);
    await runMigrations({ url: urlOf(SRC), attempts: 1 });
    const src = postgres(urlOf(SRC), { max: 1, onnotice: () => {} });
    try {
      const [customer] = await src`insert into customers (company_name) values ('Drill Ltd') returning id`;
      const [quote] = await src`
        insert into quotations (quotation_number, customer_id, salesperson, valid_until, total_amount)
        values ('QT-DRILL-001', ${customer.id}, 'Alice', '2026-12-31', 10500) returning id`;
      await src`insert into quotation_items (quotation_id, product_name, quantity, unit_price) values (${quote.id}, 'Widget', 2, 5000)`;
    } finally {
      await src.end({ timeout: 5 });
    }
    const dump = path.join(tmp, "quote.dump");
    execFileSync("pg_dump", ["-Fc", "-f", dump, "-d", SRC], { env });

    // 2. The new server already runs a newer release (one more migration).
    const next = newerRelease();
    await admin.unsafe(`create database "${DST}"`);
    await runMigrations({ url: urlOf(DST), migrationsFolder: next, attempts: 1 });

    // 3. The documented restore, command by command.
    for (const { script, stdin } of restoreScripts("docs/deploy/backup.md", /^## Restore$/m)) {
      const res = spawnSync("sh", ["-c", script], {
        env,
        input: stdin ? fs.readFileSync(dump) : undefined,
        encoding: "utf8",
      });
      expect({ script, status: res.status, stderr: res.stderr }).toEqual({ script, status: 0, stderr: "" });
    }

    // 4. The newer release starts: its migration applies cleanly on the restored data.
    await runMigrations({ url: urlOf(DST), migrationsFolder: next, attempts: 1 });
    const dst = postgres(urlOf(DST), { max: 1, onnotice: () => {} });
    try {
      const [{ count }] = await dst`select count(*)::int as count from drizzle.__drizzle_migrations`;
      expect(count).toBe(JSON.parse(fs.readFileSync(path.join(next, "meta", "_journal.json"), "utf8")).entries.length);
      expect(await dst`select quotation_number from quotations`).toEqual([{ quotation_number: "QT-DRILL-001" }]);
      expect(await dst`select product_name, position from quotation_items`).toEqual([{ product_name: "Widget", position: 0 }]);
      expect(await dst`select count(*)::int as count from drill_invoices`).toEqual([{ count: 0 }]);
    } finally {
      await dst.end({ timeout: 5 });
    }
  });
});
