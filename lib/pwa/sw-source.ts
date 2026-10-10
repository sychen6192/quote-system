// The service worker served at /sw.js (spec §9). Hand-written rather than
// Serwist: its Next plugin is webpack-only, and its defaults would precache
// public/ and cache DB-backed pages and API responses.
//
// Kept as source text so the route can inline the build ID: the bytes change
// on every deploy, which is what makes registration.update() notice it.

/** Response headers for /sw.js (mirrored in next.config.ts). */
export const SERVICE_WORKER_HEADERS: Readonly<Record<string, string>> = {
  "Content-Type": "application/javascript; charset=utf-8",
  "Cache-Control": "no-cache, no-store, must-revalidate",
  "Service-Worker-Allowed": "/",
};

export const OFFLINE_URL = "/offline.html";

export type SwRoute = "static" | "icon" | "navigate" | "bypass";

/**
 * Which strategy a request gets. Plain ES2017, inlined into the worker and
 * evaluated by the unit tests. Everything not listed is left to the browser:
 * Server Actions (POST), /api/* (PDFs, CSV, branding), RSC payloads and the
 * worker/manifest themselves.
 */
export const SW_ROUTE_SOURCE = `function routeFor(request, origin) {
  if (request.method !== "GET") return "bypass";
  var url;
  try {
    url = new URL(request.url);
  } catch (error) {
    return "bypass";
  }
  if (url.origin !== origin) return "bypass";
  var path = url.pathname;
  if (path === "/api" || path.indexOf("/api/") === 0) return "bypass";
  if (path.indexOf("/_next/data/") === 0) return "bypass";
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") return "bypass";
  if (path === "/sw.js" || path === "/manifest.webmanifest") return "bypass";
  if (path.indexOf("/_next/static/") === 0) {
    return path.indexOf("/_next/static/service-worker/") === 0 ? "bypass" : "static";
  }
  if (path.indexOf("/icons/") === 0) return "icon";
  if (request.mode === "navigate") return "navigate";
  return "bypass";
}`;

export function serviceWorkerSource(version: string): string {
  return `/* Quote System service worker. Generated per build; do not edit. */
"use strict";

const VERSION = ${JSON.stringify(version)};
const STATIC_CACHE = "qs-static-" + VERSION;
const ICON_CACHE = "qs-icons-" + VERSION;
const OFFLINE_CACHE = "qs-offline-" + VERSION;
const CURRENT_CACHES = [STATIC_CACHE, ICON_CACHE, OFFLINE_CACHE];
const OFFLINE_URL = ${JSON.stringify(OFFLINE_URL)};
const ICON_CACHE_LIMIT = 40;

${SW_ROUTE_SOURCE}

function offlineRequest() {
  return new Request(OFFLINE_URL, { cache: "reload" });
}

async function precacheOfflinePage() {
  const cache = await caches.open(OFFLINE_CACHE);
  await cache.add(offlineRequest());
}

// Logout and storage pressure can wipe the cache under a running worker.
async function ensureOfflinePage() {
  const cache = await caches.open(OFFLINE_CACHE);
  if (!(await cache.match(OFFLINE_URL))) await cache.add(offlineRequest());
}

async function deleteCaches(keep) {
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => !keep.includes(key)).map((key) => caches.delete(key)));
}

async function trimCache(cache, limit) {
  const keys = await cache.keys();
  // Insertion order: the oldest entries go first.
  await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map((key) => cache.delete(key)));
}

// Hashed, immutable build assets.
async function cacheFirst(event) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(event.request);
  if (cached) return cached;
  const response = await fetch(event.request);
  if (response.status === 200 && response.type === "basic") {
    event.waitUntil(cache.put(event.request, response.clone()));
  }
  return response;
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(ICON_CACHE);
  const cached = await cache.match(event.request);
  const network = fetch(event.request).then(async (response) => {
    if (response.status === 200 && response.type === "basic") {
      await cache.put(event.request, response.clone());
      await trimCache(cache, ICON_CACHE_LIMIT);
    }
    return response;
  });
  if (cached) {
    event.waitUntil(network.catch(() => undefined));
    return cached;
  }
  return network;
}

// Pages are always fresh from the network and never stored: they hold
// customer data, and a stale quote is worse than an honest offline page.
async function networkFirstNavigation(event) {
  try {
    const response = (await event.preloadResponse) || (await fetch(event.request));
    event.waitUntil(ensureOfflinePage().catch(() => undefined));
    return response;
  } catch (error) {
    const cache = await caches.open(OFFLINE_CACHE);
    return (await cache.match(OFFLINE_URL)) || Response.error();
  }
}

self.addEventListener("install", (event) => {
  // No skipWaiting(): an update waits until the user picks "Reload".
  event.waitUntil(precacheOfflinePage());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await deleteCaches(CURRENT_CACHES);
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  const type = event.data && event.data.type;
  if (type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (type === "CLEAR_CACHES") {
    // The offline page holds nothing private; put it straight back.
    event.waitUntil(deleteCaches([]).then(precacheOfflinePage).catch(() => undefined));
  } else if (type === "GET_VERSION" && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ type: "VERSION", version: VERSION });
  }
});

self.addEventListener("fetch", (event) => {
  const route = routeFor(event.request, self.location.origin);
  if (route === "static") event.respondWith(cacheFirst(event));
  else if (route === "icon") event.respondWith(staleWhileRevalidate(event));
  else if (route === "navigate") event.respondWith(networkFirstNavigation(event));
});
`;
}

/**
 * Served instead when PWA_DISABLE_SW=true: replaces any installed worker,
 * wipes its caches and unregisters. It has no fetch handler, so pages load
 * straight from the network meanwhile; open tabs are not reloaded.
 */
export function killSwitchSource(): string {
  return `/* Quote System service worker: disabled (PWA_DISABLE_SW). */
"use strict";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) client.postMessage({ type: "SW_DISABLED" });
    })()
  );
});
`;
}

/** PWA_DISABLE_SW: only "1" / "true" switch it on, like the other flags. */
export function isServiceWorkerDisabled(raw: string | undefined): boolean {
  const value = (raw ?? "").trim().replace(/^["']|["']$/g, "").toLowerCase();
  return value === "1" || value === "true";
}
