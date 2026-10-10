// Keeps the env-var documentation and the deploy bundle in step with the code:
// a variable the app reads but .env.example / README never mention is a
// setting nobody can discover.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..", "..", "..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

const SOURCE_DIRS = ["actions", "app", "components", "db", "lib", "services"];
const SOURCE_FILES = ["proxy.ts", "instrumentation.ts", "next.config.ts", "drizzle.config.ts"];

// Read by the code but not user settings.
const INTERNAL = new Set([
  "NODE_ENV",
  "NEXT_RUNTIME",
  "NEXT_PHASE",
  "NEXT_DIST_DIR", // parallel local builds
  "TEST_DATABASE_URL", // tests only, documented in the README's Development section
  "TZ", // documented as APP_TIMEZONE's fallback
]);

function sourceFiles(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(rel);
    return /\.(ts|tsx|mjs|js)$/.test(entry.name) ? [rel] : [];
  });
}

function envVarsReadByCode(): string[] {
  const names = new Set<string>();
  const patterns = [
    /process\.env\.([A-Z][A-Z0-9_]*)/g,
    /\benv\.([A-Z][A-Z0-9_]*)/g,
    /\benv\[["']([A-Z][A-Z0-9_]*)["']\]/g,
  ];
  const files = [...SOURCE_DIRS.flatMap(sourceFiles), ...SOURCE_FILES.filter((f) => fs.existsSync(path.join(ROOT, f)))];
  for (const file of files) {
    const text = read(file);
    for (const re of patterns) {
      for (const match of text.matchAll(re)) names.add(match[1]);
    }
  }
  return [...names].filter((name) => !INTERNAL.has(name)).sort();
}

/** `KEY=` lines, commented out or not. */
function envFileKeys(file: string): Set<string> {
  const keys = new Set<string>();
  for (const line of read(file).split("\n")) {
    const match = /^#?\s*([A-Z][A-Z0-9_]*)=/.exec(line.trim());
    if (match) keys.add(match[1]);
  }
  return keys;
}

/** `${VAR}`, `${VAR:-x}`, `${VAR:?msg}` references (not `$${VAR}` escapes). */
function composeVars(file: string): { name: string; required: boolean }[] {
  const out = new Map<string, boolean>();
  for (const match of read(file).matchAll(/(?<!\$)\$\{([A-Z][A-Z0-9_]*)(:?[-?])?/g)) {
    const required = match[2] === undefined || match[2].endsWith("?");
    out.set(match[1], (out.get(match[1]) ?? false) || required);
  }
  return [...out].map(([name, required]) => ({ name, required }));
}

describe("environment variable documentation", () => {
  const vars = envVarsReadByCode();

  it("finds the variables the app reads", () => {
    expect(vars).toEqual(expect.arrayContaining(["DATABASE_URL", "APP_PASSWORD", "COMPANY_NAME", "RESEND_API_KEY"]));
  });

  it.each(vars)("%s is in .env.example", (name) => {
    expect(envFileKeys(".env.example").has(name)).toBe(true);
  });

  it.each(vars)("%s is in both READMEs", (name) => {
    // As `NAME` or `NAME=value`.
    const mention = new RegExp(`\`${name}[\`=]`);
    expect(read("README.md")).toMatch(mention);
    expect(read("README.zh-TW.md")).toMatch(mention);
  });
});

describe("deploy bundle", () => {
  const compose = "deploy/docker-compose.yml";

  it("ships the files the installer and the release job expect", () => {
    for (const file of ["docker-compose.yml", "Caddyfile", ".env.example", "install.sh", "README.md"]) {
      expect(fs.existsSync(path.join(ROOT, "deploy", file))).toBe(true);
    }
  });

  it("documents every variable docker-compose.yml uses", () => {
    const keys = envFileKeys("deploy/.env.example");
    const readme = read("README.md");
    for (const { name, required } of composeVars(compose)) {
      // Required ones must be in the template install.sh fills in.
      if (required) expect({ name, inTemplate: keys.has(name) }).toEqual({ name, inTemplate: true });
      expect({ name, documented: keys.has(name) || readme.includes(`\`${name}\``) }).toEqual({
        name,
        documented: true,
      });
    }
  });

  it("never publishes the database port", () => {
    expect(read(compose)).not.toMatch(/["']?[\d.:]*5432:5432/);
    // The contributor stack binds it to loopback only.
    const dev = read("docker-compose.yaml");
    for (const match of dev.matchAll(/^\s*-\s*["']?([^"'\s]*):5432["']?\s*$/gm)) {
      expect(match[1]).toMatch(/^127\.0\.0\.1:/);
    }
  });

  it("the installer is wrapped in main so a truncated download does nothing", () => {
    const script = read("deploy/install.sh");
    expect(script.startsWith("#!/bin/sh\n")).toBe(true);
    expect(script).toMatch(/^set -eu$/m);
    const lastCommand = script
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .pop();
    expect(lastCommand).toBe('main "$@"');
  });

  it("Caddy serves IP addresses and non-default HTTPS ports", () => {
    const caddyfile = read("deploy/Caddyfile");
    // Browsers send no SNI for https://<ip>; without a default Caddy drops the handshake.
    expect(caddyfile).toMatch(/^\s*default_sni \{\$SITE_ADDRESS\}$/m);
    // The site listens on HTTPS_PORT so redirects carry it; compose must publish it 1:1.
    expect(caddyfile).toMatch(/^\{\$SITE_ADDRESS\}:\{\$HTTPS_PORT:443\} \{$/m);
    expect(read(compose)).toContain('- "${HTTPS_PORT:-443}:${HTTPS_PORT:-443}"');
    expect(read(compose)).toMatch(/^\s+HTTPS_PORT: \$\{HTTPS_PORT:-443\}$/m);
  });

  it("pins QUOTE_VERSION in a line the release job can rewrite", () => {
    expect(read("deploy/.env.example")).toMatch(/^QUOTE_VERSION=latest$/m);
  });
});
