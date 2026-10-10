// DNS-rebinding guard for installs with sign-in off (spec: "trusted LAN only").
//
// With APP_PASSWORD empty, nothing but the network keeps strangers out, and
// both CSRF checks (Next's for Server Actions, isSameOrigin for route
// handlers) only compare Origin with Host. A web page on attacker.example
// that re-points its own DNS name at 192.168.x.x becomes same-origin with the
// app under that name, so those checks pass. Browsers always send the name
// they resolved as Host, and a page cannot change it: refusing names the
// install is not known by stops the attack.
//
// Refusing is opt-in, so upgrading never locks out an install that is reached
// through its own domain with sign-in off:
// - APP_HOSTS empty (the default): every host name is served. The first time
//   a name that is not a local one (see below) shows up, the process logs one
//   warning recommending APP_PASSWORD or APP_HOSTS.
// - APP_HOSTS set: only known names are served, the rest get 421. Known names
//   are IP literals, localhost, single-label names (http://quotes/), the usual
//   private-network suffixes, SITE_ADDRESS and the APP_HOSTS entries
//   (comma-separated; `*.example.com` covers subdomains, `*` allows every
//   name and silences the warning).

type Env = Record<string, string | undefined>;

const PRIVATE_SUFFIXES = [".local", ".lan", ".home", ".home.arpa", ".internal", ".localdomain", ".localhost"];

function cleanEnv(raw: string | undefined): string {
  const v = (raw ?? "").trim();
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1).trim();
  }
  return v;
}

/** The lower-case host name of a Host header value (port and trailing dot dropped), or null. */
export function hostName(raw: string | null | undefined): string | null {
  let h = (raw ?? "").trim().toLowerCase();
  if (h === "") return null;
  if (h.startsWith("[")) {
    const end = h.indexOf("]");
    if (end < 0) return null;
    const rest = h.slice(end + 1);
    if (rest !== "" && !/^:\d{1,5}$/.test(rest)) return null;
    return h.slice(0, end + 1);
  }
  const colon = h.lastIndexOf(":");
  if (colon >= 0) {
    if (!/^\d{1,5}$/.test(h.slice(colon + 1))) return null;
    h = h.slice(0, colon);
  }
  if (h.endsWith(".")) h = h.slice(0, -1);
  if (h === "" || !/^[a-z0-9._-]+$/.test(h)) return null;
  return h;
}

function isIpv4(h: string): boolean {
  const parts = h.split(".");
  return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

function isIpv6Literal(h: string): boolean {
  return /^\[[0-9a-f:.]+(%25[0-9a-z._~-]+)?\]$/.test(h) && h.includes(":");
}

/** Host part of SITE_ADDRESS (`quote.example.com`, `https://x:8443`, `192.168.1.20`). */
function siteAddressHost(env: Env): string | null {
  const raw = cleanEnv(env.SITE_ADDRESS).replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").split("/")[0];
  return hostName(raw);
}

function configuredHosts(env: Env): string[] {
  return cleanEnv(env.APP_HOSTS)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Unknown host names are refused only when APP_HOSTS lists at least one entry. */
export function hostAllowListEnforced(env: Env = process.env): boolean {
  return configuredHosts(env).length > 0;
}

function matchesEntry(host: string, entry: string): boolean {
  if (entry === "*") return true;
  if (entry.startsWith("*.")) {
    const suffix = entry.slice(1);
    return host.endsWith(suffix) && host.length > suffix.length;
  }
  if (entry.startsWith(".")) return host === entry.slice(1) || host.endsWith(entry);
  return hostName(entry) === host;
}

/**
 * Whether the install is known by this name: an IP literal, localhost, a
 * single-label or private-suffix name, SITE_ADDRESS or an APP_HOSTS entry.
 * Says nothing about enforcement; see {@link isAllowedHost}.
 */
export function isKnownHost(raw: string | null | undefined, env: Env = process.env): boolean {
  const host = hostName(raw);
  const extra = configuredHosts(env);
  if (extra.includes("*")) return true;
  if (host === null) return false;

  if (isIpv4(host) || isIpv6Literal(host)) return true;
  if (host === "localhost") return true;
  if (!host.includes(".")) return true;
  if (PRIVATE_SUFFIXES.some((s) => host.endsWith(s))) return true;
  if (siteAddressHost(env) === host) return true;
  return extra.some((entry) => matchesEntry(host, entry));
}

/** Whether a request under this name is served: always without APP_HOSTS, else only known names. */
export function isAllowedHost(raw: string | null | undefined, env: Env = process.env): boolean {
  return !hostAllowListEnforced(env) || isKnownHost(raw, env);
}

type HeaderSource = { get(name: string): string | null };

/** The Host value and every X-Forwarded-Host entry a request names. */
function requestHostValues(headers: HeaderSource): (string | null)[] {
  const forwarded = headers.get("x-forwarded-host");
  const extra = forwarded === null ? [] : forwarded.split(",").map((s) => s.trim()).filter(Boolean);
  return [headers.get("host"), ...extra];
}

export type HostCheck =
  /** Every name is known: serve. */
  | { verdict: "known" }
  /** APP_HOSTS is empty and a name is not a known one: serve, but warn (once). */
  | { verdict: "unknown"; host: string }
  /** APP_HOSTS is set and a name is not on it: refuse with 421. */
  | { verdict: "refused"; host: string };

/**
 * Host and, when a proxy (or the page itself, which may add it) sent one,
 * every X-Forwarded-Host entry must be known: a rebinding page can add that
 * header but cannot change Host.
 */
export function checkRequestHosts(headers: HeaderSource, env: Env = process.env): HostCheck {
  const unknown = requestHostValues(headers).find((h) => !isKnownHost(h, env));
  if (unknown === undefined) return { verdict: "known" };
  const host = hostName(unknown) ?? JSON.stringify(String(unknown ?? "").slice(0, 100));
  return hostAllowListEnforced(env) ? { verdict: "refused", host } : { verdict: "unknown", host };
}

/** True unless {@link checkRequestHosts} refuses the request. */
export function requestHostsAllowed(headers: HeaderSource, env: Env = process.env): boolean {
  return checkRequestHosts(headers, env).verdict !== "refused";
}

export function unknownHostWarning(host: string): string {
  return (
    `[auth] Sign-in is off and the app was reached under the host name ${host}, which is not a local ` +
    "address. Anyone who can reach that name can read and change your quotes, and a web page could reach " +
    "the app through DNS rebinding. Set APP_PASSWORD to require sign-in, or list the names this install " +
    "is reached by in APP_HOSTS (comma-separated) so other names are refused. " +
    "This warning is shown once per start."
  );
}

// One warning per process, even if several bundles carry a copy of this module.
const WARNED = Symbol.for("quote-system.auth.unknown-host-warned");

/** Logs {@link unknownHostWarning} the first time it is called in this process; later calls do nothing. */
export function warnUnknownHostOnce(host: string): void {
  const g = globalThis as { [WARNED]?: boolean };
  if (g[WARNED]) return;
  g[WARNED] = true;
  console.warn(unknownHostWarning(host));
}
