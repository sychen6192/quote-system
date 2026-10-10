import {
  checkRequestHosts,
  hostAllowListEnforced,
  hostName,
  isAllowedHost,
  isKnownHost,
  requestHostsAllowed,
  unknownHostWarning,
  warnUnknownHostOnce,
} from "@/lib/auth/host-allowlist";

describe("hostName", () => {
  it.each([
    ["Quotes.Example.com", "quotes.example.com"],
    ["192.168.1.20:3000", "192.168.1.20"],
    ["[::1]:3000", "[::1]"],
    ["[fe80::1]", "[fe80::1]"],
    ["nas.local.", "nas.local"],
    ["localhost:80", "localhost"],
  ])("%s → %s", (raw, expected) => expect(hostName(raw)).toBe(expected));

  it.each([null, undefined, "", "  ", "a b", "evil.example:x", "[::1", "[::1]x", "ex@mple.com", "a/b"])(
    "rejects %j",
    (raw) => expect(hostName(raw)).toBeNull()
  );
});

const KNOWN = [
  "192.168.1.20:3000",
  "10.0.0.5",
  "127.0.0.1:3000",
  "[::1]:3000",
  "[fd00::20]",
  "localhost:3000",
  "app.localhost",
  "quotes",
  "app:3000",
  "nas.local",
  "office.lan",
  "box.home",
  "box.home.arpa",
  "svc.internal",
  "pc.localdomain",
  "quote.example.com",
  "QUOTE.EXAMPLE.COM:443",
  "tunnel.example.org",
  "a.corp.example",
  "acme.test",
  "x.acme.test",
];
const UNKNOWN = [
  "rebind.attacker.example:3000",
  "rebind.attacker.example",
  "example.com",
  "corp.example",
  "evil-quote.example.com",
  "quote.example.com.evil.example",
  "local.evil.example",
  "999.1.1.1",
  "1.2.3",
  "",
  null,
];

describe("hostAllowListEnforced", () => {
  it("is on only when APP_HOSTS lists at least one entry", () => {
    expect(hostAllowListEnforced({})).toBe(false);
    expect(hostAllowListEnforced({ APP_HOSTS: "" })).toBe(false);
    expect(hostAllowListEnforced({ APP_HOSTS: "  " })).toBe(false);
    expect(hostAllowListEnforced({ APP_HOSTS: '""' })).toBe(false);
    expect(hostAllowListEnforced({ APP_HOSTS: " , ," })).toBe(false);
    expect(hostAllowListEnforced({ SITE_ADDRESS: "quote.example.com" })).toBe(false);
    expect(hostAllowListEnforced({ APP_HOSTS: "q.example.com" })).toBe(true);
    expect(hostAllowListEnforced({ APP_HOSTS: "*" })).toBe(true);
  });
});

describe("with APP_HOSTS set (names are enforced)", () => {
  const env = { SITE_ADDRESS: "quote.example.com", APP_HOSTS: "tunnel.example.org, *.corp.example, .acme.test" };

  it.each(KNOWN)("accepts %s", (host) => {
    expect(isKnownHost(host, env)).toBe(true);
    expect(isAllowedHost(host, env)).toBe(true);
  });

  it.each(UNKNOWN)("rejects %j", (host) => {
    expect(isKnownHost(host, env)).toBe(false);
    expect(isAllowedHost(host, env)).toBe(false);
  });

  it("keeps SITE_ADDRESS and local names allowed next to the listed ones", () => {
    const listed = { APP_HOSTS: "tunnel.example.org", SITE_ADDRESS: "https://q.example.com:8443/" };
    for (const host of ["q.example.com", "192.168.1.20", "nas.local", "quotes", "tunnel.example.org"]) {
      expect(isAllowedHost(host, listed)).toBe(true);
    }
    expect(isAllowedHost("other.example.com", listed)).toBe(false);
  });

  it("lets APP_HOSTS=* allow every name", () => {
    expect(isAllowedHost("rebind.attacker.example", { APP_HOSTS: "*" })).toBe(true);
    expect(isAllowedHost(null, { APP_HOSTS: "a.example, *" })).toBe(true);
    expect(isKnownHost("rebind.attacker.example", { APP_HOSTS: "*" })).toBe(true);
  });
});

describe("with APP_HOSTS empty (every name is served)", () => {
  const env = { SITE_ADDRESS: "quote.example.com" };

  it.each([...KNOWN, ...UNKNOWN])("allows %j", (host) => {
    expect(isAllowedHost(host, env)).toBe(true);
    expect(isAllowedHost(host, { ...env, APP_HOSTS: "" })).toBe(true);
  });

  it("still tells known names from unknown ones (for the warning)", () => {
    for (const host of ["192.168.1.20:3000", "nas.local", "quotes", "quote.example.com"]) {
      expect(isKnownHost(host, env)).toBe(true);
    }
    for (const host of ["tunnel.example.org", "rebind.attacker.example", null]) {
      expect(isKnownHost(host, env)).toBe(false);
    }
  });

  it("reads SITE_ADDRESS leniently", () => {
    for (const SITE_ADDRESS of ["https://q.example.com", "q.example.com:8443", '"q.example.com"', "q.example.com/"]) {
      expect(isKnownHost("q.example.com", { SITE_ADDRESS })).toBe(true);
    }
    expect(isKnownHost("q.example.com", {})).toBe(false);
  });
});

describe("checkRequestHosts / requestHostsAllowed", () => {
  const h = (init: Record<string, string>) => new Headers(init);

  it("with APP_HOSTS set, refuses unless Host and every X-Forwarded-Host entry are known", () => {
    const env = { APP_HOSTS: "q.example.com" };
    expect(checkRequestHosts(h({ host: "192.168.1.20:3000" }), env)).toEqual({ verdict: "known" });
    expect(checkRequestHosts(h({ host: "rebind.attacker.example:3000" }), env)).toEqual({
      verdict: "refused",
      host: "rebind.attacker.example",
    });
    // A rebinding page can add X-Forwarded-Host but cannot change Host.
    expect(
      requestHostsAllowed(h({ host: "rebind.attacker.example:3000", "x-forwarded-host": "192.168.1.20" }), env)
    ).toBe(false);
    expect(requestHostsAllowed(h({ host: "app:3000", "x-forwarded-host": "q.example.com" }), env)).toBe(true);
    expect(checkRequestHosts(h({ host: "app:3000", "x-forwarded-host": "q.example.com, other.example" }), env)).toEqual({
      verdict: "refused",
      host: "other.example",
    });
    expect(requestHostsAllowed(h({}), env)).toBe(false);
  });

  it("with APP_HOSTS empty, serves every request and names the first unknown host", () => {
    expect(checkRequestHosts(h({ host: "192.168.1.20:3000" }), {})).toEqual({ verdict: "known" });
    expect(checkRequestHosts(h({ host: "nas.local", "x-forwarded-host": "quotes" }), {})).toEqual({ verdict: "known" });
    expect(checkRequestHosts(h({ host: "Quotes.Example.com:443" }), {})).toEqual({
      verdict: "unknown",
      host: "quotes.example.com",
    });
    expect(checkRequestHosts(h({ host: "app:3000", "x-forwarded-host": "q.example.com" }), {})).toEqual({
      verdict: "unknown",
      host: "q.example.com",
    });
    expect(checkRequestHosts(h({ host: "q.example.com" }), { SITE_ADDRESS: "q.example.com" })).toEqual({
      verdict: "known",
    });
    for (const headers of [h({ host: "rebind.attacker.example" }), h({ host: "a b" }), h({})]) {
      expect(requestHostsAllowed(headers, {})).toBe(true);
    }
    // A header that is not a host name is quoted, never logged raw.
    expect(checkRequestHosts(h({ host: "a b" }), {})).toEqual({ verdict: "unknown", host: '"a b"' });
  });
});

describe("warnUnknownHostOnce", () => {
  const WARNED = Symbol.for("quote-system.auth.unknown-host-warned");
  let warn: jest.SpyInstance;
  beforeEach(() => {
    delete (globalThis as { [WARNED]?: boolean })[WARNED];
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it("logs one warning per process that recommends APP_PASSWORD or APP_HOSTS", () => {
    warnUnknownHostOnce("quotes.example.com");
    warnUnknownHostOnce("quotes.example.com");
    warnUnknownHostOnce("other.example.com");
    expect(warn).toHaveBeenCalledTimes(1);
    const message = warn.mock.calls[0][0] as string;
    expect(message).toBe(unknownHostWarning("quotes.example.com"));
    expect(message).toMatch(/quotes\.example\.com/);
    expect(message).toMatch(/APP_PASSWORD/);
    expect(message).toMatch(/APP_HOSTS/);
  });
});
