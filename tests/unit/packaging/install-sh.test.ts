// The installer's helpers edit the user's .env in place, so they must survive
// any value (passwords with sed/awk metacharacters) and never lose other lines.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const INSTALLER = path.join(__dirname, "..", "..", "..", "deploy", "install.sh");

/** Runs `body` in POSIX sh with the installer's functions loaded (without running main). */
function sh(body: string, cwd: string): string {
  const functions = fs.readFileSync(INSTALLER, "utf8").replace(/^main "\$@"\s*$/m, "");
  return execFileSync("sh", ["-c", `${functions}\n${body}`], { cwd, encoding: "utf8" });
}

// The installer is POSIX sh; Windows contributors run it under WSL instead.
const describeSh = process.platform === "win32" ? describe.skip : describe;

describeSh("deploy/install.sh helpers", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "install-sh-"));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("set_env replaces a key, keeps every other line and any characters in the value", () => {
    fs.writeFileSync(path.join(dir, ".env"), "# comment\nAPP_PASSWORD=old\nAPP_PASSWORD_HINT=keep\nOTHER=1\n");
    const value = String.raw`a&b/c\d|e$f"g'h`;
    sh(`set_env APP_PASSWORD '${value.replace(/'/g, `'\\''`)}' .env`, dir);
    expect(fs.readFileSync(path.join(dir, ".env"), "utf8")).toBe(
      `# comment\nAPP_PASSWORD=${value}\nAPP_PASSWORD_HINT=keep\nOTHER=1\n`,
    );
  });

  it("set_env appends a missing key and keeps the file's permissions", () => {
    const file = path.join(dir, ".env");
    fs.writeFileSync(file, "A=1\n", { mode: 0o600 });
    sh("set_env QUOTE_VERSION 1.2.3 .env", dir);
    expect(fs.readFileSync(file, "utf8")).toBe("A=1\nQUOTE_VERSION=1.2.3\n");
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  });

  it("env_value reads the last KEY= line and ignores keys that only share a prefix", () => {
    fs.writeFileSync(path.join(dir, ".env"), "HTTPS_PORT=8443\nPORT=1\nPORT=2\n# PORT=3\n");
    expect(sh("env_value PORT .env", dir)).toBe("2\n");
    expect(sh("env_value MISSING .env", dir)).toBe("\n");
  });

  it.each([
    ["2.17.0", true],
    ["2.29.7", true],
    ["5.6.0", true],
    ["2.16.9", false],
    ["1.29.2", false],
    ["", false],
    ["dev", false],
  ])("version_at_least %p 2 17 -> %p", (version, ok) => {
    expect(sh(`if version_at_least '${version}' 2 17; then echo yes; else echo no; fi`, dir)).toBe(ok ? "yes\n" : "no\n");
  });

  it("generates passwords that are safe in a URL and an env file", () => {
    const out = sh("random_string 32; echo; friendly_password; echo", dir).split("\n");
    expect(out[0]).toMatch(/^[A-Za-z0-9]{32}$/);
    expect(out[1]).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(out[1]).not.toMatch(/[ilo01]/);
  });
});
