// The installer's helpers edit the user's .env in place, so they must survive
// any value (passwords with sed/awk metacharacters) and never lose other lines.
import { execFileSync, spawnSync } from "node:child_process";
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

// The whole script against a fake `docker` and a local release, so the
// decisions it makes before anything is pulled or started are covered.
describeSh("deploy/install.sh end to end (docker shim)", () => {
  const VOLUME = "quote-system_postgres_data";
  let tmp: string;
  let home: string;
  let release: string;
  let log: string;

  beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "install-run-")));
    home = path.join(tmp, "home");
    release = path.join(tmp, "release");
    log = path.join(tmp, "docker.log");
    fs.mkdirSync(home);
    fs.mkdirSync(release);
    fs.mkdirSync(path.join(tmp, "bin"));

    // The release bundle, as the release job builds it.
    const deploy = path.join(__dirname, "..", "..", "..", "deploy");
    execFileSync("tar", ["-C", deploy, "-czf", path.join(release, "quote-system-deploy.tar.gz"), "docker-compose.yml", "Caddyfile", ".env.example", "README.md"]);
    const sum = execFileSync("sh", ["-c", "sha256sum quote-system-deploy.tar.gz 2>/dev/null || shasum -a 256 quote-system-deploy.tar.gz"], { cwd: release, encoding: "utf8" });
    fs.writeFileSync(path.join(release, "SHA256SUMS"), sum);

    // `docker`: logs "<cwd>|<args>", and for `compose up` the variables that
    // override .env; the volume and its containers come from SHIM_* variables.
    fs.writeFileSync(
      path.join(tmp, "bin", "docker"),
      `#!/bin/sh
echo "$PWD|$*" >> "$SHIM_LOG"
case "$*" in
  "compose up -d"*) echo "COMPOSE_PROFILES=\${COMPOSE_PROFILES-<unset>} APP_BIND=\${APP_BIND-<unset>}" >> "$SHIM_LOG.env" ;;
esac
case "$*" in
  "compose version") echo "Docker Compose version v2.30.0" ;;
  "ps -aq --filter label=com.docker.compose.project=quote-system --filter label=com.docker.compose.service=caddy") printf '%s\\n' "\${SHIM_CADDY:-}" ;;
  "compose version --short") echo "2.30.0" ;;
  "volume inspect ${VOLUME}") [ -n "\${SHIM_VOLUME:-}" ] || exit 1 ;;
  "ps -a"*"label=com.docker.compose.service=db"*) printf '%s\\n' "\${SHIM_DB_OWNER:-}" ;;
  "ps -a"*) printf '%s\\n' "\${SHIM_OWNER:-}" ;;
  "compose up --help") echo "      --wait-timeout int" ;;
esac
exit 0
`,
      { mode: 0o755 },
    );
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  function install(cwd: string, env: Record<string, string> = {}) {
    // The installer's own inputs come only from `env`.
    const base: NodeJS.ProcessEnv = { ...process.env };
    for (const k of Object.keys(base)) if (/^(QUOTE_|APP_PASSWORD|APP_PORT|APP_BIND|COMPOSE_)/.test(k)) delete base[k];
    const res = spawnSync("sh", [INSTALLER], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...base,
        HOME: home,
        PATH: `${path.join(tmp, "bin")}:${process.env.PATH}`,
        QUOTE_BASE_URL: `file://${release}`,
        QUOTE_SKIP_PULL: "1",
        SHIM_LOG: log,
        ...env,
      },
    });
    return { status: res.status, stdout: res.stdout, stderr: res.stderr };
  }
  const started = () =>
    fs.existsSync(log) ? fs.readFileSync(log, "utf8").split("\n").filter((l) => l.includes("|compose up -d")) : [];
  const mode = (file: string) => fs.statSync(file).mode & 0o777;

  it("a new install keeps .env and the database dumps private", () => {
    const res = install(home);
    expect(res).toMatchObject({ status: 0 });
    const dir = path.join(home, "quote-system");
    expect(mode(path.join(dir, ".env"))).toBe(0o600);
    // Dumps hold every customer and quote (and the company stamp).
    expect(mode(path.join(dir, "backups"))).toBe(0o700);
    expect(started()).toEqual([expect.stringMatching(new RegExp(`^${dir}\\|compose up -d`))]);
  });

  it("re-running it inside an install directory upgrades that directory", () => {
    const dir = path.join(tmp, "volume1", "docker", "quote-system");
    expect(install(home, { QUOTE_DIR: dir })).toMatchObject({ status: 0 });
    fs.chmodSync(path.join(dir, "backups"), 0o755); // made by an older installer
    fs.rmSync(log);

    const res = install(dir, { SHIM_VOLUME: "1", SHIM_DB_OWNER: dir, SHIM_OWNER: dir });
    expect(res).toMatchObject({ status: 0 });
    expect(started()).toEqual([expect.stringMatching(new RegExp(`^${dir}\\|compose up -d`))]);
    expect(fs.existsSync(path.join(home, "quote-system"))).toBe(false);
    expect(mode(path.join(dir, "backups"))).toBe(0o700);
  });

  it("from elsewhere it points at the existing install instead of offering to delete its data", () => {
    const dir = path.join(tmp, "volume1", "docker", "quote-system");
    const res = install(home, { SHIM_VOLUME: "1", SHIM_DB_OWNER: dir, SHIM_OWNER: dir });
    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain(`QUOTE_DIR=${dir}`);
    expect(res.stderr).not.toContain("docker volume rm");
    // Nothing was written to the wrong place.
    expect(fs.existsSync(path.join(home, "quote-system"))).toBe(false);
    expect(started()).toEqual([]);
  });

  it("a database used by other containers (the 0.x compose file) is never offered for deletion", () => {
    const old = path.join(tmp, "src", "quote-system");
    const res = install(home, { SHIM_VOLUME: "1", SHIM_OWNER: old });
    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain(old);
    expect(res.stderr).toContain("Upgrading from 0.x");
    expect(res.stderr).not.toContain("docker volume rm");
    expect(fs.existsSync(path.join(home, "quote-system"))).toBe(false);
  });

  it("an unused leftover database volume may be deleted", () => {
    const res = install(home, { SHIM_VOLUME: "1" });
    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain(`docker volume rm ${VOLUME}`);
    expect(fs.existsSync(path.join(home, "quote-system"))).toBe(false);
  });

  it("tells how to upgrade without losing the pinned version", () => {
    const res = install(home);
    expect(res.stdout).toMatch(/QUOTE_VERSION/);
    expect(res.stdout).toContain(`QUOTE_DIR=${path.join(home, "quote-system")}`);
  });

  describe("APP_BIND with the https profile", () => {
    const dir = () => path.join(home, "quote-system");
    const envFile = () => path.join(dir(), ".env");
    const env = (key: string) => {
      const lines = fs.readFileSync(envFile(), "utf8").split("\n").filter((l) => l.startsWith(`${key}=`));
      return lines.length === 0 ? undefined : lines[lines.length - 1].slice(key.length + 1);
    };
    const setEnv = (key: string, value: string) => {
      const text = fs.readFileSync(envFile(), "utf8");
      const re = new RegExp(`^${key}=.*$`, "m");
      fs.writeFileSync(envFile(), re.test(text) ? text.replace(re, `${key}=${value}`) : `${text}${key}=${value}\n`);
    };
    /** What `docker compose up` saw in its environment (overrides .env), one line per run. */
    const composeEnv = () => fs.readFileSync(`${log}.env`, "utf8").trim().split("\n");
    const reinstall = (extra: Record<string, string> = {}) =>
      install(dir(), { SHIM_VOLUME: "1", SHIM_DB_OWNER: dir(), SHIM_OWNER: dir(), ...extra });

    it("a new install without it serves plain HTTP on every interface", () => {
      expect(install(home)).toMatchObject({ status: 0 });
      expect(env("APP_BIND")).toBe("");
      expect(env("COMPOSE_PROFILES")).toBe("");
    });

    it("a new install with COMPOSE_PROFILES=https keeps port 3000 on this machine and saves the profile", () => {
      const res = install(home, { COMPOSE_PROFILES: "https,backup" });
      expect(res).toMatchObject({ status: 0 });
      expect(env("COMPOSE_PROFILES")).toBe("https,backup");
      expect(env("APP_BIND")).toBe("127.0.0.1");
      expect(res.stdout).toContain("APP_BIND=127.0.0.1");
      // Compose reads both from .env, not from the installer's environment.
      expect(composeEnv()).toEqual(["COMPOSE_PROFILES=<unset> APP_BIND=<unset>"]);
    });

    it("an APP_BIND given to the installer wins over the default", () => {
      expect(install(home, { COMPOSE_PROFILES: "https", APP_BIND: "0.0.0.0" })).toMatchObject({ status: 0 });
      expect(env("APP_BIND")).toBe("0.0.0.0");
    });

    it("turning the profile on in .env fills an empty APP_BIND on the next run", () => {
      expect(install(home)).toMatchObject({ status: 0 });
      setEnv("COMPOSE_PROFILES", "backup, https");
      expect(reinstall()).toMatchObject({ status: 0 });
      expect(env("APP_BIND")).toBe("127.0.0.1");
    });

    it("Caddy started by hand (docker compose --profile https up -d) counts as on", () => {
      expect(install(home)).toMatchObject({ status: 0 });
      expect(reinstall({ SHIM_CADDY: "0123456789ab" })).toMatchObject({ status: 0 });
      expect(env("APP_BIND")).toBe("127.0.0.1");
    });

    it("never rewrites an APP_BIND the user set, but warns while it is reachable around Caddy", () => {
      expect(install(home)).toMatchObject({ status: 0 });
      // As 1.0.0 created it.
      setEnv("APP_BIND", "0.0.0.0");
      setEnv("COMPOSE_PROFILES", "https");
      const res = reinstall();
      expect(res).toMatchObject({ status: 0 });
      expect(env("APP_BIND")).toBe("0.0.0.0");
      expect(res.stderr).toContain("APP_BIND=0.0.0.0 also serves plain HTTP on port 3000");
      expect(res.stderr).toContain("set APP_BIND=127.0.0.1");

      setEnv("APP_BIND", "127.0.0.1");
      expect(reinstall().stderr).not.toContain("APP_BIND");
    });

    it("re-runs are idempotent and never replace .env values with the installer's inputs", () => {
      expect(install(home, { COMPOSE_PROFILES: "https" })).toMatchObject({ status: 0 });
      const first = fs.readFileSync(envFile(), "utf8");
      expect(reinstall()).toMatchObject({ status: 0 });
      expect(reinstall({ COMPOSE_PROFILES: "backup", APP_BIND: "0.0.0.0" })).toMatchObject({ status: 0 });
      expect(fs.readFileSync(envFile(), "utf8")).toBe(first);
      expect(composeEnv()).toEqual(Array(3).fill("COMPOSE_PROFILES=<unset> APP_BIND=<unset>"));
    });

    it.each([
      ["COMPOSE_PROFILES", "https\nAPP_PASSWORD="],
      ["COMPOSE_PROFILES", "https backup"],
      ["APP_BIND", "0.0.0.0\nAPP_PASSWORD="],
      ["APP_BIND", "$(id)"],
    ])("refuses %s=%j before writing anything", (key, value) => {
      const res = install(home, { [key]: value });
      expect(res.status).not.toBe(0);
      expect(res.stderr).toContain(key);
      expect(fs.existsSync(dir())).toBe(false);
    });
  });
});
