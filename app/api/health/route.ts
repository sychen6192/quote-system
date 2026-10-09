import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

// Container healthchecks give up after ~5 s; answer before that.
const DB_TIMEOUT_MS = 3000;

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("health check timed out")), DB_TIMEOUT_MS);
      }),
    ]);
    return NextResponse.json({ status: "ok" }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503, headers: NO_STORE });
  } finally {
    clearTimeout(timer);
  }
}
