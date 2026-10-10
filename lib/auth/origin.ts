type HeaderSource = { get(name: string): string | null };

function normalizeHost(host: string, protocol: string): string {
  const h = host.trim().toLowerCase();
  if (protocol === "https:" && h.endsWith(":443")) return h.slice(0, -4);
  if (protocol === "http:" && h.endsWith(":80")) return h.slice(0, -3);
  return h;
}

/**
 * CSRF check for plain route handlers (Server Actions get one from Next, route
 * handlers do not): the browser-supplied Origin (or Referer) must name the host
 * the request was sent to, as seen directly or through a reverse proxy.
 *
 * Requests with neither header are allowed: browsers always send Origin on
 * cross-site POSTs, so only non-browser clients (curl, scripts) omit both.
 */
export function isSameOrigin(headers: HeaderSource): boolean {
  const source = headers.get("origin") ?? headers.get("referer");
  if (source === null) return true;

  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return false; // includes the opaque "null" origin
  }
  const sourceHost = normalizeHost(url.host, url.protocol);

  const candidates = [
    headers.get("x-forwarded-host")?.split(",")[0],
    headers.get("host"),
  ].filter((h): h is string => typeof h === "string" && h.trim() !== "");

  return candidates.some((h) => normalizeHost(h, url.protocol) === sourceHost);
}
