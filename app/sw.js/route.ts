import { getBuildId } from "@/lib/pwa/build-id";
import {
  SERVICE_WORKER_HEADERS,
  isServiceWorkerDisabled,
  killSwitchSource,
  serviceWorkerSource,
} from "@/lib/pwa/sw-source";

export const dynamic = "force-dynamic";

let cached: { key: string; body: string } | null = null;

/** The service worker; PWA_DISABLE_SW=true serves one that removes itself. */
export function GET() {
  const disabled = isServiceWorkerDisabled(process.env.PWA_DISABLE_SW);
  const key = disabled ? "disabled" : getBuildId();
  if (cached?.key !== key) {
    cached = { key, body: disabled ? killSwitchSource() : serviceWorkerSource(key) };
  }
  return new Response(cached.body, { headers: SERVICE_WORKER_HEADERS });
}
