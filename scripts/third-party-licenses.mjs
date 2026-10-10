// Writes THIRD_PARTY_LICENSES.txt: the license and notice files of every npm
// package whose code ships with the app. The Docker image runs it after
// `next build` and copies the result next to LICENSE (MIT, BSD and Apache
// licenses ask for their text to travel with copies of the code).
//
//   node scripts/third-party-licenses.mjs [--out FILE] [--root DIR] [--dist DIR]
//
// A package is listed when any of these hold:
// - it is in the production dependency tree: a package-lock.json entry that
//   is installed and neither dev nor devOptional (a dev dependency that a
//   production package only lists as optional, like @playwright/test for next);
// - Next traced it into <dist>/standalone/node_modules;
// - a server source map in <dist> names a file in it (code compiled into the
//   app's chunks, including client components rendered on the server);
// - it generates the app's CSS (Tailwind and its plugins).
// Listing a package that ends up unused is harmless; missing one is not.
import fs from "node:fs";
import path from "node:path";

const CSS_PACKAGES = ["tailwindcss", "tailwindcss-animate", "@tailwindcss/container-queries"];
// LICENSE, LICENCE.txt, COPYING, NOTICE, CopyrightNotice.txt, and the
// THIRD-PARTY-NOTICES.md / ThirdPartyNotices.txt of packages that bundle
// other code (prettier).
const LICENSE_FILE = /^(?:third[-_]?party[-_]?)?(?:licen[sc]es?|copying|copyright(?:notice)?|notices?)(?:[-_.].*)?$/i;
const CODE_FILE = /\.(?:[cm]?[jt]sx?|json|map|html?|css)$/i; // e.g. lib/license.js
// node_modules/<name> or node_modules/@scope/<name>, possibly nested.
const PACKAGE_PATH = /(?:^|\/)((?:node_modules\/(?:@[^/]+\/)?[^/]+\/)*node_modules\/(?:@[^/]+\/)?[^/]+)\//;
const PACKAGE_NAME = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/.][^/]*)\//g;

function parseArgs(argv) {
  const args = { root: process.cwd(), dist: process.env.NEXT_DIST_DIR || ".next", out: null };
  for (let i = 0; i < argv.length; i += 2) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (!["--root", "--dist", "--out"].includes(flag) || value === undefined) {
      throw new Error(`usage: third-party-licenses.mjs [--out FILE] [--root DIR] [--dist DIR] (got ${flag})`);
    }
    args[flag.slice(2)] = value;
  }
  return args;
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

/** Every file under dir whose name passes `keep`, skipping nested node_modules unless asked. */
function walk(dir, keep, { intoNodeModules = false } = {}) {
  const found = [];
  const visit = (current) => {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" && !intoNodeModules) continue;
        visit(full);
      } else if (entry.isFile() && keep(entry.name, full)) {
        found.push(full);
      }
    }
  };
  visit(dir);
  return found;
}

/** Relative package paths ("node_modules/a/node_modules/@s/b") the build uses. */
function collectPackagePaths(root, dist) {
  const paths = new Set();

  const lockFile = path.join(root, "package-lock.json");
  if (fs.existsSync(lockFile)) {
    for (const [key, entry] of Object.entries(readJson(lockFile).packages ?? {})) {
      if (key.startsWith("node_modules/") && !entry.dev && !entry.devOptional && !entry.link) paths.add(key);
    }
  }

  const distDir = path.resolve(root, dist);
  const standalone = path.join(distDir, "standalone");
  for (const file of walk(path.join(standalone, "node_modules"), (name) => name === "package.json", {
    intoNodeModules: true,
  })) {
    const match = path.relative(standalone, file).split(path.sep).join("/").match(PACKAGE_PATH);
    if (match) paths.add(match[1]);
  }

  for (const file of walk(distDir, (name) => name.endsWith(".map"), { intoNodeModules: false })) {
    const top = path.relative(distDir, file).split(path.sep)[0];
    if (top === "standalone" || top === "cache") continue;
    let sources;
    try {
      sources = readJson(file).sources ?? [];
    } catch {
      continue;
    }
    for (const source of sources) {
      const rel = packageOfSource(root, String(source));
      if (rel) paths.add(rel);
    }
  }

  for (const name of CSS_PACKAGES) paths.add(`node_modules/${name}`);
  return { paths, hasBuild: fs.existsSync(distDir) };
}

/**
 * The installed package a source-map entry belongs to. Turbopack writes
 * paths relative to the map ("../../../node_modules/%40scope/name/…");
 * packages that ship their own source maps can point into their build tree
 * instead (e.g. "node_modules/.aspect_rules_js/…/node_modules/@formatjs/…"),
 * so fall back to the innermost package name installed at the top level.
 */
function packageOfSource(root, source) {
  let text = source.replace(/\\/g, "/");
  try {
    text = decodeURIComponent(text);
  } catch {
    // keep the raw text
  }
  const chain = text.match(PACKAGE_PATH)?.[1];
  if (chain && fs.existsSync(path.join(root, chain, "package.json"))) return chain;
  const names = [...text.matchAll(PACKAGE_NAME)].map((m) => m[1]);
  const innermost = names.at(-1);
  return innermost && fs.existsSync(path.join(root, "node_modules", innermost, "package.json"))
    ? `node_modules/${innermost}`
    : null;
}

function licenseOf(pkg) {
  const { license, licenses } = pkg;
  if (typeof license === "string") return license;
  if (license && typeof license === "object" && license.type) return license.type;
  if (Array.isArray(licenses)) {
    return licenses.map((l) => (typeof l === "string" ? l : l?.type)).filter(Boolean).join(" OR ");
  }
  return "UNKNOWN";
}

function sourceOf(pkg) {
  const repo = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
  const url = repo || pkg.homepage || "";
  return url
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^github:/, "https://github.com/")
    .replace(/\.git$/, "");
}

/** One entry per name@version, with its license files read from the root install. */
function describePackages(root, dist, relPaths) {
  const standalone = path.resolve(root, dist, "standalone");
  const byId = new Map();
  for (const rel of [...relPaths].sort()) {
    // Standalone holds only traced files; prefer the full install for the license texts.
    const dir = [path.join(root, rel), path.join(standalone, rel)].find((d) =>
      fs.existsSync(path.join(d, "package.json"))
    );
    if (!dir) continue;
    let pkg;
    try {
      pkg = readJson(path.join(dir, "package.json"));
    } catch {
      continue;
    }
    if (!pkg.name || !pkg.version) continue;
    const id = `${pkg.name}@${pkg.version}`;
    if (byId.has(id)) continue;
    // Top-level license files first, then ones for code the package bundles
    // (e.g. next/dist/compiled/<dependency>/LICENSE).
    const files = walk(dir, (name) => LICENSE_FILE.test(name) && !CODE_FILE.test(name))
      .map((file) => path.relative(dir, file).split(path.sep).join("/"))
      .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
    byId.set(id, {
      name: pkg.name,
      version: pkg.version,
      license: licenseOf(pkg),
      source: sourceOf(pkg),
      files: files.map((rel) => ({ rel, text: fs.readFileSync(path.join(dir, rel), "utf8").trim() })),
    });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

function render(packages) {
  const rule = "-".repeat(72);
  const out = [
    "Third-party software in Quote System",
    "====================================",
    "",
    "Quote System includes npm packages as files under node_modules/ and",
    "compiled into the app's server and browser code. Listed below is every",
    "package in its production dependency tree plus the development packages",
    "compiled into it; a few of them (compilers, image tools) only take part",
    "in building the app. Each entry gives the license the package declares",
    "and the license and notice files it ships. Fonts and adapted source code",
    "are listed in THIRD_PARTY_NOTICES.md.",
    "Generated by scripts/third-party-licenses.mjs.",
    "",
    `${packages.length} packages`,
  ];
  for (const p of packages) {
    out.push("", rule, `${p.name} ${p.version}`, `License: ${p.license}`);
    if (p.source) out.push(`Source: ${p.source}`);
    if (p.files.length === 0) out.push("", "(The package ships no license file.)");
    for (const file of p.files) {
      if (p.files.length > 1 || file.rel.includes("/")) out.push("", `--- ${file.rel}`);
      out.push("", file.text);
    }
  }
  return out.join("\n") + "\n";
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root);
const { paths, hasBuild } = collectPackagePaths(root, args.dist);
if (!hasBuild) {
  console.error(`third-party-licenses: no build output at ${args.dist}; listing production dependencies only.`);
}
const packages = describePackages(root, args.dist, paths);
const text = render(packages);
if (args.out) {
  fs.writeFileSync(path.resolve(root, args.out), text);
  console.error(`third-party-licenses: ${packages.length} packages -> ${args.out}`);
} else {
  process.stdout.write(text);
}
