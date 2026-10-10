// Chromium fires beforeinstallprompt once, possibly before React hydrates:
// listen from module evaluation (this module loads with the layout's client
// bundle) and keep the event for whichever install button asks for it.

/** Chromium's non-standard event (MDN: BeforeInstallPromptEvent). */
export type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export type InstallPromptState = {
  /** The deferred event, while it can still be used. */
  prompt: BeforeInstallPromptEvent | null;
  /** appinstalled fired in this page. */
  installed: boolean;
};

const SERVER_STATE: InstallPromptState = { prompt: null, installed: false };

let state: InstallPromptState = SERVER_STATE;
const listeners = new Set<() => void>();

function update(next: Partial<InstallPromptState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Our own button replaces Chrome's mini-infobar.
    event.preventDefault();
    update({ prompt: event as BeforeInstallPromptEvent });
  });
  window.addEventListener("appinstalled", () => update({ prompt: null, installed: true }));
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getInstallPromptState(): InstallPromptState {
  return state;
}

export function getServerInstallPromptState(): InstallPromptState {
  return SERVER_STATE;
}

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

/** Shows the browser's install dialog. An event can prompt only once, so it is used up either way. */
export async function promptInstall(): Promise<InstallOutcome> {
  const event = state.prompt;
  if (!event) return "unavailable";
  update({ prompt: null });
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome;
  } catch {
    return "unavailable";
  }
}
