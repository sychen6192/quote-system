import * as vm from "node:vm";
import {
  OFFLINE_URL,
  SERVICE_WORKER_HEADERS,
  SW_ROUTE_SOURCE,
  isServiceWorkerDisabled,
  killSwitchSource,
  serviceWorkerSource,
  type SwRoute,
} from "@/lib/pwa/sw-source";

const ORIGIN = "https://quotes.example.com";

type FakeRequestInit = { method?: string; mode?: string; headers?: Record<string, string> };

function fakeRequest(url: string, init: FakeRequestInit = {}) {
  return {
    url: new URL(url, ORIGIN).href,
    method: init.method ?? "GET",
    mode: init.mode ?? "cors",
    headers: new Headers(init.headers ?? {}),
  };
}

const routeFor = new Function(`${SW_ROUTE_SOURCE}; return routeFor;`)() as (
  request: ReturnType<typeof fakeRequest>,
  origin: string
) => SwRoute;

describe("routeFor", () => {
  const route = (url: string, init?: FakeRequestInit) => routeFor(fakeRequest(url, init), ORIGIN);

  it("caches hashed build assets", () => {
    expect(route("/_next/static/chunks/app-123.js")).toBe("static");
    expect(route("/_next/static/css/abc.css")).toBe("static");
    expect(route("/_next/static/media/inter.woff2")).toBe("static");
  });

  it("leaves Next's own bundled worker alone", () => {
    expect(route("/_next/static/service-worker/sw.js")).toBe("bypass");
  });

  it("revalidates icons in the background", () => {
    expect(route("/icons/any-192.png?v=abc")).toBe("icon");
  });

  it("handles page navigations network-first", () => {
    expect(route("/zh-TW/quotes", { mode: "navigate" })).toBe("navigate");
    expect(route("/", { mode: "navigate" })).toBe("navigate");
  });

  it.each([
    ["Server Actions (POST)", "/en/quotes/new", { method: "POST", mode: "cors", headers: { "Next-Action": "x" } }],
    ["API routes", "/api/quotes/12/pdf", {}],
    ["API navigations (PDF in a new tab)", "/api/quotes/12/pdf", { mode: "navigate" }],
    ["the CSV export", "/api/export/quotes?lang=en", {}],
    ["RSC payloads by header", "/en/quotes", { headers: { RSC: "1" } }],
    ["RSC payloads by query", "/en/quotes?_rsc=abc", {}],
    ["prefetch navigations of RSC", "/en/quotes?_rsc=1", { mode: "navigate" }],
    ["/_next/data", "/_next/data/build/en.json", {}],
    ["the worker itself", "/sw.js", {}],
    ["the manifest", "/manifest.webmanifest", {}],
    ["other same-origin GETs", "/robots.txt", {}],
    ["HEAD requests", "/_next/static/chunks/a.js", { method: "HEAD" }],
  ] as const)("bypasses %s", (_, url, init) => {
    expect(route(url, init as FakeRequestInit)).toBe("bypass");
  });

  it("bypasses other origins", () => {
    expect(routeFor(fakeRequest("https://fonts.gstatic.com/s/inter.woff2"), ORIGIN)).toBe("bypass");
    expect(routeFor(fakeRequest("https://cdn.example.com/_next/static/a.js"), ORIGIN)).toBe("bypass");
  });
});

// ---- the whole worker in a sandbox ----------------------------------------

class FakeCache {
  entries = new Map<string, Response>();
  async match(req: string | { url: string }) {
    const key = new URL(typeof req === "string" ? req : req.url, ORIGIN).href;
    return this.entries.get(key)?.clone();
  }
  async put(req: string | { url: string }, res: Response) {
    this.entries.set(new URL(typeof req === "string" ? req : req.url, ORIGIN).href, res);
  }
  async add(req: Request) {
    const res = await sandboxFetch(req);
    if (!res.ok) throw new TypeError("bad status");
    await this.put(req, res);
  }
  async delete(req: string | { url: string }) {
    return this.entries.delete(new URL(typeof req === "string" ? req : req.url, ORIGIN).href);
  }
  async keys() {
    return [...this.entries.keys()].map((url) => new Request(url));
  }
}

class FakeCacheStorage {
  stores = new Map<string, FakeCache>();
  async open(name: string) {
    if (!this.stores.has(name)) this.stores.set(name, new FakeCache());
    return this.stores.get(name)!;
  }
  async keys() {
    return [...this.stores.keys()];
  }
  async delete(name: string) {
    return this.stores.delete(name);
  }
  async has(name: string) {
    return this.stores.has(name);
  }
}

let sandboxFetch: jest.Mock;

/** Same-origin fetches resolve to "basic" responses; a constructed Response is "default". */
function basic(body: string, init?: ResponseInit): Response {
  const res = new Response(body, init);
  Object.defineProperty(res, "type", { value: "basic" });
  return res;
}

/** Relative URLs resolve against the worker's origin, as in a real worker. */
class WorkerRequest extends Request {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(typeof input === "string" ? new URL(input, ORIGIN).href : input, init);
  }
}

type Handler = (event: unknown) => void;

function loadWorker(source: string) {
  const handlers = new Map<string, Handler>();
  const caches = new FakeCacheStorage();
  sandboxFetch = jest.fn(async (req: Request | string) => {
    const url = typeof req === "string" ? req : req.url;
    return basic(`body of ${new URL(url, ORIGIN).pathname}`, { status: 200 });
  });
  const windowClient = { postMessage: jest.fn() };
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Handler) => handlers.set(type, fn),
    skipWaiting: jest.fn(async () => undefined),
    registration: {
      navigationPreload: { enable: jest.fn(async () => undefined) },
      unregister: jest.fn(async () => true),
    },
    clients: { claim: jest.fn(async () => undefined), matchAll: jest.fn(async () => [windowClient]) },
  };
  const context = vm.createContext({
    self,
    caches,
    fetch: (...args: [Request | string]) => sandboxFetch(...args),
    Request: WorkerRequest,
    Response,
    URL,
    Headers,
    Promise,
    Math,
  });
  vm.runInContext(source, context);

  async function dispatch(type: string, extra: Record<string, unknown> = {}) {
    const waits: Promise<unknown>[] = [];
    let responded: Promise<Response> | undefined;
    const event = {
      ...extra,
      waitUntil: (p: Promise<unknown>) => waits.push(p),
      respondWith: (p: Promise<Response>) => {
        responded = p;
      },
    };
    handlers.get(type)?.(event);
    const response = responded ? await responded : undefined;
    // waitUntil may be called while the response is produced.
    for (let i = 0; i < waits.length; i++) await waits[i];
    return { response, responded: responded !== undefined };
  }

  return { handlers, caches, self, dispatch, windowClient };
}

const VERSION = "build-42";

describe("service worker", () => {
  it("inlines the build version", () => {
    expect(serviceWorkerSource(VERSION)).toContain('const VERSION = "build-42";');
    expect(serviceWorkerSource('x";alert(1);"')).toContain('const VERSION = "x\\";alert(1);\\"";');
  });

  it("precaches the offline page on install, bypassing the HTTP cache, without skipWaiting", async () => {
    const sw = loadWorker(serviceWorkerSource(VERSION));
    await sw.dispatch("install");
    const [request] = sandboxFetch.mock.calls[0] as [Request];
    expect(new URL(request.url).pathname).toBe(OFFLINE_URL);
    expect(request.cache).toBe("reload");
    expect(await sw.caches.keys()).toEqual([`qs-offline-${VERSION}`]);
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
  });

  it("deletes other caches, enables navigation preload and claims clients on activate", async () => {
    const sw = loadWorker(serviceWorkerSource(VERSION));
    await sw.caches.open("qs-static-old");
    await sw.caches.open("something-else");
    await sw.caches.open(`qs-static-${VERSION}`);
    await sw.dispatch("activate");
    expect(await sw.caches.keys()).toEqual([`qs-static-${VERSION}`]);
    expect(sw.self.registration.navigationPreload.enable).toHaveBeenCalled();
    expect(sw.self.clients.claim).toHaveBeenCalled();
  });

  it("skips waiting only when asked", async () => {
    const sw = loadWorker(serviceWorkerSource(VERSION));
    await sw.dispatch("message", { data: { type: "SKIP_WAITING" } });
    expect(sw.self.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it("wipes caches on CLEAR_CACHES and puts the public offline page back", async () => {
    const sw = loadWorker(serviceWorkerSource(VERSION));
    await (await sw.caches.open(`qs-static-${VERSION}`)).put("/_next/static/a.js", new Response("a"));
    await sw.dispatch("message", { data: { type: "CLEAR_CACHES" } });
    expect(await sw.caches.keys()).toEqual([`qs-offline-${VERSION}`]);
  });

  it("serves build assets cache-first", async () => {
    const sw = loadWorker(serviceWorkerSource(VERSION));
    const request = new Request(`${ORIGIN}/_next/static/chunks/a.js`);
    const first = await sw.dispatch("fetch", { request });
    expect(await first.response!.text()).toBe("body of /_next/static/chunks/a.js");
    const second = await sw.dispatch("fetch", { request });
    expect(await second.response!.text()).toBe("body of /_next/static/chunks/a.js");
    expect(sandboxFetch).toHaveBeenCalledTimes(1);
  });

  it("never stores navigations and falls back to the offline page without a network", async () => {
    const sw = loadWorker(serviceWorkerSource(VERSION));
    await sw.dispatch("install");
    const request = { url: `${ORIGIN}/zh-TW/quotes`, method: "GET", mode: "navigate", headers: new Headers() };

    const online = await sw.dispatch("fetch", { request, preloadResponse: Promise.resolve(undefined) });
    expect(await online.response!.text()).toBe("body of /zh-TW/quotes");
    for (const name of await sw.caches.keys()) {
      const cache = await sw.caches.open(name);
      expect(await cache.match(request.url)).toBeUndefined();
    }

    sandboxFetch.mockRejectedValue(new TypeError("Failed to fetch"));
    const offline = await sw.dispatch("fetch", { request, preloadResponse: Promise.resolve(undefined) });
    expect(await offline.response!.text()).toBe(`body of ${OFFLINE_URL}`);
  });

  it("uses the navigation preload response when there is one", async () => {
    const sw = loadWorker(serviceWorkerSource(VERSION));
    const request = { url: `${ORIGIN}/en`, method: "GET", mode: "navigate", headers: new Headers() };
    const result = await sw.dispatch("fetch", { request, preloadResponse: Promise.resolve(new Response("preloaded")) });
    expect(await result.response!.text()).toBe("preloaded");
  });

  it("restores a wiped offline page after the next successful navigation", async () => {
    const sw = loadWorker(serviceWorkerSource(VERSION));
    const request = { url: `${ORIGIN}/en`, method: "GET", mode: "navigate", headers: new Headers() };
    await sw.dispatch("fetch", { request, preloadResponse: Promise.resolve(undefined) });
    const cache = await sw.caches.open(`qs-offline-${VERSION}`);
    expect(await cache.match(OFFLINE_URL)).toBeDefined();
  });

  describe("behind a reverse proxy whose upstream is down", () => {
    const request = { url: `${ORIGIN}/en/quotes`, method: "GET", mode: "navigate", headers: new Headers() };

    it.each([
      ["Caddy / nginx bad gateway", 502],
      ["service unavailable", 503],
      ["gateway timeout", 504],
      ["Cloudflare: web server is down", 521],
      ["Cloudflare Tunnel: origin unreachable", 530],
    ])("shows the offline page for a %s (%i)", async (_, status) => {
      const sw = loadWorker(serviceWorkerSource(VERSION));
      await sw.dispatch("install");
      sandboxFetch.mockResolvedValueOnce(basic("", { status }));
      const result = await sw.dispatch("fetch", { request, preloadResponse: Promise.resolve(undefined) });
      expect(await result.response!.text()).toBe(`body of ${OFFLINE_URL}`);
    });

    it("also checks the navigation preload response", async () => {
      const sw = loadWorker(serviceWorkerSource(VERSION));
      await sw.dispatch("install");
      sandboxFetch.mockClear();
      const result = await sw.dispatch("fetch", {
        request,
        preloadResponse: Promise.resolve(new Response("", { status: 504 })),
      });
      expect(await result.response!.text()).toBe(`body of ${OFFLINE_URL}`);
      expect(sandboxFetch).not.toHaveBeenCalled();
    });

    it.each([500, 404, 401])("passes the app's own %i page through", async (status) => {
      const sw = loadWorker(serviceWorkerSource(VERSION));
      await sw.dispatch("install");
      sandboxFetch.mockResolvedValueOnce(basic(`app error ${status}`, { status }));
      const result = await sw.dispatch("fetch", { request, preloadResponse: Promise.resolve(undefined) });
      expect(result.response!.status).toBe(status);
      expect(await result.response!.text()).toBe(`app error ${status}`);
    });

    it("returns the gateway's response when the offline page is not cached, without refetching it", async () => {
      const sw = loadWorker(serviceWorkerSource(VERSION));
      await sw.dispatch("install");
      await sw.caches.delete(`qs-offline-${VERSION}`);
      sandboxFetch.mockClear();
      sandboxFetch.mockResolvedValueOnce(basic("", { status: 502 }));
      const result = await sw.dispatch("fetch", { request, preloadResponse: Promise.resolve(undefined) });
      expect(result.response!.status).toBe(502);
      expect(sandboxFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("navigations it does not handle as pages", () => {
    const navigate = (path: string, method = "GET") => ({
      url: `${ORIGIN}${path}`,
      method,
      mode: "navigate",
      headers: new Headers(),
    });

    it("answers with the navigation preload response instead of fetching again", async () => {
      const sw = loadWorker(serviceWorkerSource(VERSION));
      for (const path of ["/api/quotes/1/pdf?lang=en", "/api/export/quotes?lang=en", "/icons/any-512.png?v=1"]) {
        const result = await sw.dispatch("fetch", {
          request: navigate(path),
          preloadResponse: Promise.resolve(new Response("pdf")),
        });
        expect(result.responded).toBe(true);
        expect(await result.response!.text()).toBe("pdf");
      }
      expect(sandboxFetch).not.toHaveBeenCalled();
    });

    it("fetches once when there is no preload response", async () => {
      const sw = loadWorker(serviceWorkerSource(VERSION));
      const request = navigate("/api/quotes/1/pdf?lang=en");
      const result = await sw.dispatch("fetch", { request, preloadResponse: Promise.resolve(undefined) });
      expect(await result.response!.text()).toBe("body of /api/quotes/1/pdf");
      expect(sandboxFetch).toHaveBeenCalledTimes(1);
      expect(sandboxFetch).toHaveBeenCalledWith(request);
    });

    it("passes gateway errors through: an API response is not a page", async () => {
      const sw = loadWorker(serviceWorkerSource(VERSION));
      await sw.dispatch("install");
      const result = await sw.dispatch("fetch", {
        request: navigate("/api/health"),
        preloadResponse: Promise.resolve(new Response("", { status: 502 })),
      });
      expect(result.response!.status).toBe(502);
    });

    it("leaves POST navigations (sign-out) to the browser", async () => {
      const sw = loadWorker(serviceWorkerSource(VERSION));
      const result = await sw.dispatch("fetch", { request: navigate("/api/auth/logout", "POST") });
      expect(result.responded).toBe(false);
    });
  });

  it("does not answer API, RSC or POST requests", async () => {
    const sw = loadWorker(serviceWorkerSource(VERSION));
    for (const request of [
      new Request(`${ORIGIN}/api/quotes/1/pdf`),
      new Request(`${ORIGIN}/en/quotes?_rsc=x`),
      new Request(`${ORIGIN}/en/quotes`, { method: "POST", body: "x" }),
    ]) {
      expect((await sw.dispatch("fetch", { request })).responded).toBe(false);
    }
  });

  it("serves icons stale-while-revalidate", async () => {
    const sw = loadWorker(serviceWorkerSource(VERSION));
    const request = new Request(`${ORIGIN}/icons/any-192.png?v=1`);
    await sw.dispatch("fetch", { request });
    sandboxFetch.mockResolvedValueOnce(basic("fresh"));
    const second = await sw.dispatch("fetch", { request });
    expect(await second.response!.text()).toBe("body of /icons/any-192.png");
    const third = await sw.dispatch("fetch", { request });
    expect(await third.response!.text()).toBe("fresh");
  });
});

describe("kill switch", () => {
  it("activates at once, clears every cache, unregisters and tells the pages", async () => {
    const sw = loadWorker(killSwitchSource());
    await sw.caches.open("qs-static-1");
    await sw.dispatch("install");
    expect(sw.self.skipWaiting).toHaveBeenCalled();
    await sw.dispatch("activate");
    expect(await sw.caches.keys()).toEqual([]);
    expect(sw.self.registration.unregister).toHaveBeenCalled();
    expect(sw.windowClient.postMessage).toHaveBeenCalledWith({ type: "SW_DISABLED" });
    expect(sw.handlers.has("fetch")).toBe(false);
  });

  it("tells the pages while installing, before they can mistake it for an update", async () => {
    const sw = loadWorker(killSwitchSource());
    await sw.dispatch("install");
    expect(sw.self.clients.matchAll).toHaveBeenCalledWith({ type: "window", includeUncontrolled: true });
    expect(sw.windowClient.postMessage).toHaveBeenCalledWith({ type: "SW_DISABLED" });
    expect(sw.self.skipWaiting).toHaveBeenCalled();
  });

  it.each([
    ["true", true],
    ["1", true],
    ['"true"', true],
    ["TRUE", true],
    ["false", false],
    ["yes", false],
    ["", false],
    [undefined, false],
  ])("PWA_DISABLE_SW=%s → %s", (raw, expected) => {
    expect(isServiceWorkerDisabled(raw)).toBe(expected);
  });
});

describe("headers", () => {
  it("are never cached and allow the root scope", () => {
    expect(SERVICE_WORKER_HEADERS).toEqual({
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    });
  });
});
