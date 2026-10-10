import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPT = path.join(process.cwd(), "scripts/third-party-licenses.mjs");

/** Writes files (relative path → content) under dir. */
function write(dir: string, files: Record<string, string>) {
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
}

const pkg = (name: string, version: string, extra: object = {}) =>
  JSON.stringify({ name, version, license: "MIT", ...extra });

function run(root: string, args: string[] = []) {
  return execFileSync(process.execPath, [SCRIPT, "--root", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    // NEXT_DIST_DIR (parallel local builds) would point the script elsewhere.
    env: { ...process.env, NEXT_DIST_DIR: "" },
  });
}

describe("scripts/third-party-licenses.mjs", () => {
  let root: string;

  beforeEach(() => {
    // Under a directory named "cache", like ~/.cache checkouts: only the
    // build's own cache/ is skipped.
    root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "licenses-")), "cache", "app");
    write(root, {
      "package.json": pkg("app", "1.0.0"),
      "package-lock.json": JSON.stringify({
        lockfileVersion: 3,
        packages: {
          "": { name: "app" },
          "node_modules/prod-dep": { version: "1.0.0" },
          "node_modules/prod-dep/node_modules/nested": { version: "2.0.0" },
          "node_modules/build-only": { version: "1.0.0", dev: true },
          "node_modules/@scope/icons": { version: "3.0.0", dev: true },
          "node_modules/traced": { version: "1.0.0", dev: true },
          "node_modules/inner": { version: "1.0.0", dev: true },
          "node_modules/tailwindcss": { version: "3.4.0", dev: true },
          "node_modules/test-runner": { version: "1.0.0", devOptional: true },
          "node_modules/linked": { link: true, resolved: "../linked" },
        },
      }),
      "node_modules/prod-dep/package.json": pkg("prod-dep", "1.0.0", {
        repository: { type: "git", url: "git+https://github.com/example/prod-dep.git" },
      }),
      "node_modules/prod-dep/LICENSE": "Copyright (c) Prod Dep authors\n",
      "node_modules/prod-dep/lib/license.js": "module.exports = 'code, not a license';\n",
      "node_modules/prod-dep/dist/compiled/bundled/LICENSE.md": "Bundled dependency license\n",
      "node_modules/prod-dep/THIRD-PARTY-NOTICES.md": "Bundled notices\n",
      "node_modules/prod-dep/node_modules/nested/package.json": pkg("nested", "2.0.0"),
      "node_modules/prod-dep/node_modules/nested/LICENCE.txt": "Nested license\n",
      "node_modules/build-only/package.json": pkg("build-only", "1.0.0"),
      "node_modules/build-only/LICENSE": "Build-only license\n",
      "node_modules/@scope/icons/package.json": pkg("@scope/icons", "3.0.0", { license: "ISC" }),
      "node_modules/@scope/icons/LICENSE": "Icons license\n",
      "node_modules/traced/package.json": pkg("traced", "1.0.0", { license: undefined, licenses: [{ type: "BSD-3-Clause" }] }),
      "node_modules/traced/COPYING": "Traced license\n",
      "node_modules/inner/package.json": pkg("inner", "1.0.0"),
      "node_modules/tailwindcss/package.json": pkg("tailwindcss", "3.4.0"),
      "node_modules/tailwindcss/LICENSE": "Tailwind license\n",
      "node_modules/test-runner/package.json": pkg("test-runner", "1.0.0"),
      "node_modules/test-runner/LICENSE": "Test runner license\n",
      // Build output: a traced package, and server source maps naming a
      // scoped dev package (relative and URL-encoded, as Turbopack writes it)
      // and a package whose own source map points into its build tree.
      ".next/standalone/node_modules/traced/package.json": pkg("traced", "1.0.0"),
      ".next/standalone/node_modules/traced/index.js": "",
      ".next/server/chunks/ssr/a.js.map": JSON.stringify({
        version: 3,
        sources: [
          "../../../node_modules/%40scope/icons/dist/esm/icons/plus.js",
          "turbopack:///[project]/node_modules/.aspect_rules_js/inner@1.0.0/node_modules/inner/lib/x.js",
          "turbopack:///[project]/components/ui/button.tsx",
        ],
      }),
      ".next/server/chunks/broken.js.map": "{ not json",
    });
  });

  afterEach(() => fs.rmSync(path.dirname(path.dirname(root)), { recursive: true, force: true }));

  const entries = (text: string) => text.match(/^\S+ \d+\.\d+\.\d+$/gm) ?? [];

  it("lists production dependencies, traced packages, compiled-in packages and Tailwind", () => {
    const text = run(root);
    expect(entries(text)).toEqual([
      "@scope/icons 3.0.0",
      "inner 1.0.0",
      "nested 2.0.0",
      "prod-dep 1.0.0",
      "tailwindcss 3.4.0",
      "traced 1.0.0",
    ]);
    expect(text).toContain("\n6 packages\n");
    expect(text).not.toContain("build-only");
    expect(text).not.toContain("test-runner");
    expect(text).not.toMatch(/^app 1\.0\.0$/m);
  });

  it("includes each package's license files, bundled ones too, but not code named license", () => {
    const text = run(root);
    const section = (name: string) => text.split(/^-{72}$/m).find((s) => s.trimStart().startsWith(`${name} `)) ?? "";

    const prod = section("prod-dep");
    expect(prod).toContain("License: MIT");
    expect(prod).toContain("Source: https://github.com/example/prod-dep");
    expect(prod).toContain("Copyright (c) Prod Dep authors");
    expect(prod).toContain("--- dist/compiled/bundled/LICENSE.md");
    expect(prod).toContain("Bundled dependency license");
    expect(prod).toContain("--- THIRD-PARTY-NOTICES.md");
    expect(prod).toContain("Bundled notices");
    expect(prod).not.toContain("code, not a license");
    expect(prod).not.toContain("Nested license");

    expect(section("nested")).toContain("Nested license");
    expect(section("@scope/icons")).toContain("License: ISC");
    expect(section("traced")).toContain("License: BSD-3-Clause");
    expect(section("traced")).toContain("Traced license");
    expect(section("inner")).toContain("(The package ships no license file.)");
  });

  it("is deterministic and writes --out relative to the root", () => {
    expect(run(root)).toBe(run(root));
    run(root, ["--out", "THIRD_PARTY_LICENSES.txt"]);
    expect(fs.readFileSync(path.join(root, "THIRD_PARTY_LICENSES.txt"), "utf8")).toBe(run(root));
  });

  it("falls back to the production dependencies when there is no build", () => {
    fs.rmSync(path.join(root, ".next"), { recursive: true });
    expect(entries(run(root))).toEqual(["nested 2.0.0", "prod-dep 1.0.0", "tailwindcss 3.4.0"]);
  });

  it("rejects unknown arguments", () => {
    expect(() => run(root, ["--nope", "x"])).toThrow(/usage/);
  });
});

describe("Docker image", () => {
  const dockerfile = fs.readFileSync(path.join(process.cwd(), "Dockerfile"), "utf8");

  it("generates THIRD_PARTY_LICENSES.txt after the build and ships it", () => {
    const build = dockerfile.indexOf("RUN npm run build");
    const generate = dockerfile.indexOf("node scripts/third-party-licenses.mjs --out THIRD_PARTY_LICENSES.txt");
    expect(build).toBeGreaterThan(-1);
    expect(generate).toBeGreaterThan(build);
    expect(dockerfile).toMatch(/^COPY --from=builder .*\/app\/THIRD_PARTY_LICENSES\.txt \.\/$/m);
  });

  it("keeps the script in the build context", () => {
    const ignored = fs.readFileSync(path.join(process.cwd(), ".dockerignore"), "utf8").split("\n");
    expect(ignored).not.toContain("scripts");
    expect(ignored).not.toContain("scripts/");
  });
});
