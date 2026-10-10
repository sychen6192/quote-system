import "server-only";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import pkg from "@/package.json";

let buildId: string | null = null;

/** Hash of the package version and this process's start: changes on every restart. */
export function fallbackBuildId(version: string, bootTime: number): string {
  return createHash("sha256").update(`${version}:${bootTime}`).digest("hex").slice(0, 16);
}

/**
 * The Next build ID (<distDir>/BUILD_ID), read once per process. Without it
 * (unusual layouts), every restart counts as a new version: an extra update
 * prompt is better than never offering one.
 */
export function getBuildId(): string {
  if (buildId) return buildId;
  const distDir = process.env.NEXT_DIST_DIR || ".next";
  try {
    const file = path.join(/* turbopackIgnore: true */ process.cwd(), distDir, "BUILD_ID");
    const id = readFileSync(file, "utf8").trim();
    if (id) return (buildId = id);
  } catch {
    // fall through
  }
  return (buildId = fallbackBuildId(pkg.version ?? "", Date.now()));
}
