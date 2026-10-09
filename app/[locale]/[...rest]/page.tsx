import { notFound } from "next/navigation";

// Rendered per request so the 404 comes from notFound() below (inside the
// locale layout), not from the build-time "unknown params" fallback.
export const dynamic = "force-dynamic";

// Unknown paths under a valid locale render the localized not-found page
// (app/[locale]/not-found.tsx) inside the app shell instead of Next's bare 404.
export default function CatchAllPage(): never {
  notFound();
}
