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

/** Line numbers (0-based) of `needle` in a file, with the file's lines. */
function linesWith(file: string, needle: string | RegExp): { lines: string[]; hits: number[] } {
  const lines = read(file).split("\n");
  const hits = lines.flatMap((line, i) =>
    (typeof needle === "string" ? line.includes(needle) : needle.test(line)) ? [i] : [],
  );
  return { lines, hits };
}

const DEPLOY_DOCS = fs
  .readdirSync(path.join(ROOT, "docs", "deploy"))
  .filter((f) => f.endsWith(".md"))
  .map((f) => `docs/deploy/${f}`);
const USER_DOCS = ["README.md", "README.zh-TW.md", "deploy/README.md", ...DEPLOY_DOCS];

describe("APP_PASSWORD characters (compose expands $ and strips ' #...' in .env)", () => {
  // install.sh validates exactly this set; the docs must say the same.
  const script = read("deploy/install.sh");
  const listed = /APP_PASSWORD may only contain letters, digits and ([^"]+)"/.exec(script)?.[1];

  it("install.sh's message matches the characters it accepts", () => {
    expect(listed).toBeDefined();
    const symbols = listed!.split(" ").join("");
    const pattern = /\*\[!A-Za-z0-9([^\]]+)\]\*\)/.exec(script)?.[1];
    expect([...(pattern ?? "")].sort()).toEqual([...symbols].sort());
  });

  it.each(["deploy/.env.example", "README.md", "README.zh-TW.md", "docs/deploy/docker-desktop.md", "docs/deploy/docker-desktop.zh-TW.md"])(
    "%s lists the safe characters and the single-quote escape",
    (file) => {
      const text = read(file);
      expect(text).toContain(listed!);
      expect(text).toMatch(/APP_PASSWORD='/);
    },
  );
});

describe("the contributor stack never shares the bundle's database", () => {
  const nameOf = (file: string) => /^name:\s*["']?([^"'\s#]+)/m.exec(read(file))?.[1];

  it("docker-compose.yaml has its own project name (volume quote-system-dev_postgres_data)", () => {
    // Without one, a clone in a folder named quote-system gets project
    // quote-system: the same volume as an installed bundle, and two
    // PostgreSQL servers on one data directory.
    expect(nameOf("deploy/docker-compose.yml")).toBe("quote-system");
    expect(nameOf("docker-compose.yaml")).toBeTruthy();
    expect(nameOf("docker-compose.yaml")).not.toBe(nameOf("deploy/docker-compose.yml"));
  });
});

describe("restore instructions", () => {
  const files = [...USER_DOCS, "deploy/docker-compose.yml"];

  it.each(files)("%s restores into an empty database and stops at the first error", (file) => {
    // --clean only drops what the dump contains: tables and migration rows of
    // a newer version survive and break the next start.
    for (const line of read(file).split("\n").filter((l) => /pg_restore\b/.test(l))) {
      expect(line).not.toMatch(/--clean/);
      if (/\s-d\s/.test(line)) expect(line).toMatch(/--exit-on-error/);
    }
  });
});

describe("upgrade instructions", () => {
  const files = [...USER_DOCS, "deploy/docker-compose.yml", "deploy/install.sh", ".github/workflows/pipeline.yml"];

  it.each(files)("%s says to change QUOTE_VERSION next to every `docker compose pull`", (file) => {
    // Every install pins an exact QUOTE_VERSION, so pull alone re-pulls the same image.
    const { lines, hits } = linesWith(file, "docker compose pull");
    for (const i of hits) {
      const around = lines.slice(Math.max(0, i - 6), i + 2).join("\n");
      expect({ line: lines[i].trim(), mentionsVersion: around.includes("QUOTE_VERSION") }).toEqual({
        line: lines[i].trim(),
        mentionsVersion: true,
      });
    }
  });
});

describe("Windows instructions", () => {
  it("the READMEs do not send Windows users to the Linux commands", () => {
    // Windows PowerShell 5.1 has no `&&`, `curl` is Invoke-WebRequest and its
    // pipeline corrupts binary output.
    expect(read("README.md")).not.toMatch(/same commands work in PowerShell/i);
    expect(read("README.zh-TW.md")).not.toMatch(/PowerShell 執行相同指令/);
  });
});

describe("login proxies in front of the app", () => {
  it.each(["docs/deploy/https.md", "docs/deploy/https.zh-TW.md"])(
    "%s says which paths a login proxy must let through for installs",
    (file) => {
      const text = read(file);
      for (const p of ["/manifest.webmanifest", "/icons/", "/sw.js", "/offline.html"]) expect(text).toContain(p);
    },
  );
});

describe("APP_HOSTS (opt-in host allow-list with sign-in off)", () => {
  const source = read("lib/auth/host-allowlist.ts");
  const suffixes = [...(/const PRIVATE_SUFFIXES = \[([^\]]+)\]/.exec(source)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);

  it("the code still refuses only when APP_HOSTS is set, with an 'Unknown host' answer", () => {
    expect(suffixes.length).toBeGreaterThan(0);
    expect(source).toMatch(/hostAllowListEnforced\(env\) \? \{ verdict: "refused"/);
    expect(read("proxy.ts")).toContain('"Unknown host: add it to APP_HOSTS\\n"');
  });

  it.each([".env.example", "deploy/.env.example", "README.md", "README.zh-TW.md"])(
    "%s names every always-allowed suffix",
    (file) => {
      const text = read(file);
      for (const suffix of suffixes) expect({ suffix, listed: text.includes(suffix) }).toEqual({ suffix, listed: true });
    },
  );

  it.each([".env.example", "deploy/.env.example"])("%s says an empty APP_HOSTS serves any host name", (file) => {
    const text = read(file);
    const block = text.slice(text.lastIndexOf("\n\n", text.indexOf("\nAPP_HOSTS=")), text.indexOf("\nAPP_HOSTS="));
    expect(block).toMatch(/Empty: the app answers under any host name/);
    expect(block).toMatch(/APP_PASSWORD|install\.sh sets/);
  });

  it.each([...USER_DOCS, ".env.example", "deploy/.env.example", "CHANGELOG.md"])(
    "%s does not claim that sign-in off alone refuses other names",
    (file) => {
      // 1.0.1 made the allow-list opt-in: without APP_HOSTS every name is served.
      const text = read(file);
      expect(text).not.toMatch(/(otherwise|or) the app answers "Unknown host"/);
      expect(text).not.toMatch(/only answers to IP addresses/);
      expect(text).not.toMatch(/Sign-in off no longer means any host name/);
      expect(text).not.toMatch(/否則 App 會回應「Unknown host」|App 也只接受 IP 位址/);
    },
  );
});

describe("APP_BIND", () => {
  it("an empty APP_BIND in .env still means every interface", () => {
    // deploy/.env.example ships APP_BIND= so install.sh can tell "never set" apart.
    expect(read("deploy/.env.example")).toMatch(/^APP_BIND=$/m);
    expect(read("deploy/docker-compose.yml")).toContain('"${APP_BIND:-0.0.0.0}:${APP_PORT:-3000}:3000"');
  });

  it.each(["docs/deploy/https.md", "docs/deploy/https.zh-TW.md"])(
    "%s keeps port 3000 off the network behind a Cloudflare Tunnel",
    (file) => {
      const text = read(file);
      const tunnel = text.slice(text.indexOf("### Cloudflare Tunnel"), text.indexOf("\n## ", text.indexOf("### Cloudflare Tunnel")));
      expect(tunnel).toContain("APP_BIND=127.0.0.1");
    },
  );
});

describe("backups", () => {
  it("the backup service writes dumps readable only by the owner of ./backups", () => {
    const compose = read("deploy/docker-compose.yml");
    const backup = compose.slice(compose.indexOf("\n  backup:"), compose.indexOf("\nvolumes:"));
    expect(backup).toMatch(/^\s+umask 077$/m);
    expect(backup).toMatch(/chown "\$\$\(stat -c %u:%g \/backups\)"/);
  });
});

describe("release version", () => {
  it("package.json carries the newest released CHANGELOG version", () => {
    // Settings → About and the PWA build id show pkg.version; a release
    // section added without the bump would ship as the previous version.
    const pkg = JSON.parse(read("package.json"));
    const lock = JSON.parse(read("package-lock.json"));
    const newest = /^## \[(\d+\.\d+\.\d+)\] - \d{4}-\d{2}-\d{2}$/m.exec(read("CHANGELOG.md"))?.[1];
    expect(newest).toBeDefined();
    expect(pkg.version).toBe(newest);
    expect(lock.version).toBe(newest);
    expect(lock.packages[""].version).toBe(newest);
  });
});

describe("Node.js version", () => {
  const pkg = JSON.parse(read("package.json"));
  const major = (range: string) => Number(/(\d+)/.exec(range)?.[1]);

  it("@types/node, engines, the Docker image and CI use the same Node major", () => {
    // Newer @types/node would type-check APIs the Node 22 runtime lacks.
    const runtime = Number(/^FROM node:(\d+)-alpine AS runner$/m.exec(read("Dockerfile"))?.[1]);
    expect(runtime).toBeGreaterThan(0);
    expect(major(pkg.devDependencies["@types/node"])).toBe(runtime);
    expect(major(pkg.engines.node)).toBe(runtime);
    for (const match of read(".github/workflows/pipeline.yml").matchAll(/node-version:\s*(\d+)/g)) {
      expect(Number(match[1])).toBe(runtime);
    }
  });

  it("Dependabot keeps @types/node on that major", () => {
    const dependabot = read(".github/dependabot.yml");
    expect(dependabot).toMatch(/- dependency-name: "?@types\/node"?\n\s+versions: \[">=\d+/);
    const ignored = Number(/- dependency-name: "?@types\/node"?\n\s+versions: \[">=(\d+)/.exec(dependabot)?.[1]);
    expect(ignored).toBe(major(pkg.devDependencies["@types/node"]) + 1);
  });
});

describe("dependencies", () => {
  const pkg = JSON.parse(read("package.json"));
  // Used without an import: CLIs, config keys, implicit type packages.
  const NOT_IMPORTED = new Set([
    "typescript", // tsc, next build
    "jest", // CLI (ts-jest is its preset)
    "autoprefixer", // postcss.config.js plugin key
    "postcss", // loads postcss.config.js for next build
    "tailwindcss", // postcss.config.js plugin key (also imported by tailwind.config.ts)
    "@types/jest",
    "@types/node",
    "@types/react",
    "@types/react-dom",
  ]);
  const SKIP = new Set(["node_modules", ".git", "coverage", "test-results", "playwright-report", "docs"]);

  function files(dir: string): string[] {
    return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) return SKIP.has(entry.name) || entry.name.startsWith(".next") ? [] : files(rel);
      return /\.(ts|tsx|js|mjs|cjs|css)$/.test(entry.name) ? [rel] : [];
    });
  }
  const sources = files(".").map(read).join("\n");

  it.each([...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)])(
    "%s is used by the code or tooling",
    (name) => {
      if (NOT_IMPORTED.has(name)) return;
      // import "x", from "x/sub", require("x"), @import "x"
      expect({ name, imported: sources.includes(`"${name}"`) || sources.includes(`"${name}/`) || sources.includes(`'${name}'`) || sources.includes(`'${name}/`) }).toEqual({ name, imported: true });
    },
  );

  it("declares what the scripts import", () => {
    // scripts/check-messages.mjs runs in `npm run lint`; a hoisted transitive
    // package can disappear with any next-intl update.
    for (const match of read("scripts/check-messages.mjs").matchAll(/from "([^".][^"]*)"/g)) {
      const name = match[1].startsWith("@") ? match[1].split("/").slice(0, 2).join("/") : match[1].split("/")[0];
      if (name.startsWith("node:")) continue;
      expect({ name, declared: name in pkg.dependencies || name in pkg.devDependencies }).toEqual({ name, declared: true });
    }
  });
});
