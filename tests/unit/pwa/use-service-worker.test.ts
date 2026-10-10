// useServiceWorker against a fake ServiceWorkerContainer (node env, no jsdom):
// effects run synchronously, the browser objects are minimal stand-ins.

const toast = Object.assign(jest.fn(), { dismiss: jest.fn() });

jest.mock("sonner", () => ({ toast }));
jest.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useEffect: (effect: () => void) => {
    effect();
  },
  useRef: <T>(value: T) => ({ current: value }),
}));

type Listener = (event: { data?: unknown }) => void;

class FakeTarget {
  listeners = new Map<string, Listener[]>();
  addEventListener(type: string, fn: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  removeEventListener(type: string, fn: Listener) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((l) => l !== fn));
  }
  emit(type: string, event: { data?: unknown } = {}) {
    for (const fn of this.listeners.get(type) ?? []) fn(event);
  }
}

class FakeWorker extends FakeTarget {
  state = "installing";
  scriptURL = "https://quotes.example.com/sw.js";
  postMessage = jest.fn();
  become(state: string) {
    this.state = state;
    this.emit("statechange");
  }
}

class FakeRegistration extends FakeTarget {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
  active: FakeWorker | null = new FakeWorker();
  update = jest.fn(async () => undefined);
  /** A new /sw.js was found (an update, or the kill switch). */
  found(): FakeWorker {
    const worker = new FakeWorker();
    this.installing = worker;
    this.emit("updatefound");
    return worker;
  }
}

function setGlobal(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

const originals = { navigator: globalThis.navigator };

async function mount() {
  const registration = new FakeRegistration();
  const container = Object.assign(new FakeTarget(), {
    controller: new FakeWorker(),
    register: jest.fn(async () => registration),
    getRegistrations: jest.fn(async () => [registration]),
  });
  const session = new Map<string, string>();
  setGlobal("navigator", { serviceWorker: container });
  setGlobal(
    "window",
    Object.assign(new FakeTarget(), {
      isSecureContext: true,
      sessionStorage: {
        getItem: (key: string) => session.get(key) ?? null,
        setItem: (key: string, value: string) => session.set(key, value),
      },
      setInterval: jest.fn(() => 1),
      clearInterval: jest.fn(),
      matchMedia: () => ({ matches: false }),
      location: { reload: jest.fn() },
    })
  );
  setGlobal("document", Object.assign(new FakeTarget(), { readyState: "complete", visibilityState: "visible" }));

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const hook = require("@/components/pwa/use-service-worker") as typeof import("@/components/pwa/use-service-worker");
  // Effects run inline (react is mocked above), so a plain call mounts it.
  const runHook = hook.useServiceWorker;
  runHook();
  await Promise.resolve(); // register() resolves
  await Promise.resolve();
  expect(container.register).toHaveBeenCalled();
  return { registration, container, session };
}

beforeAll(() => {
  process.env.NEXT_PUBLIC_ENABLE_SW = "true";
});

afterAll(() => {
  delete process.env.NEXT_PUBLIC_ENABLE_SW;
  setGlobal("navigator", originals.navigator);
  delete (globalThis as Record<string, unknown>).window;
  delete (globalThis as Record<string, unknown>).document;
});

beforeEach(() => {
  jest.resetModules();
});

describe("useServiceWorker", () => {
  it("offers to reload when a new version has installed", async () => {
    const { registration } = await mount();
    registration.found().become("installed");
    expect(toast).toHaveBeenCalledWith("title", expect.objectContaining({ id: "pwa-update" }));
  });

  it("keeps the Reload toast up as long as the other action toasts", async () => {
    const { ACTION_TOAST_DURATION_MS } = jest.requireActual<typeof import("@/components/ui/toast-layer")>(
      "@/components/ui/toast-layer"
    );
    const { registration } = await mount();
    registration.found().become("installed");
    expect(toast).toHaveBeenCalledWith(
      "title",
      expect.objectContaining({ duration: ACTION_TOAST_DURATION_MS, action: expect.objectContaining({ label: "reload" }) })
    );
  });

  it("never offers the PWA_DISABLE_SW kill switch as a new version", async () => {
    const { registration, container, session } = await mount();
    const killSwitch = registration.found();
    container.emit("message", { data: { type: "SW_DISABLED" } });
    killSwitch.become("installed");
    expect(toast).not.toHaveBeenCalled();
    expect(session.get("qs:sw-disabled")).toBe("1");
  });

  it("takes back an update toast when the kill switch speaks up late", async () => {
    const { registration, container } = await mount();
    registration.found().become("installed");
    expect(toast).toHaveBeenCalledTimes(1);
    container.emit("message", { data: { type: "SW_DISABLED" } });
    expect(toast.dismiss).toHaveBeenCalledWith("pwa-update");
  });

  it("ignores other messages", async () => {
    const { registration, container } = await mount();
    container.emit("message", { data: { type: "VERSION", version: "x" } });
    expect(toast.dismiss).not.toHaveBeenCalled();
    registration.found().become("installed");
    expect(toast).toHaveBeenCalledTimes(1);
  });
});
