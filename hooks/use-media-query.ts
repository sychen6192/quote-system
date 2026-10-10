// Adapted from Invoify (https://github.com/al1abb/invoify), MIT License, Copyright (c) 2023 Ali Abbasov.

import { useMemo, useSyncExternalStore } from "react"

/** Tailwind `xl`: the form + live-preview two-pane layout. */
export const DESKTOP_MEDIA_QUERY = "(min-width: 1280px)"

type MatchMediaHost = Pick<Window, "matchMedia">

/**
 * The useSyncExternalStore triple for one media query. `host` is injectable so
 * the store can be tested without a DOM.
 */
export function createMediaQueryStore(
  query: string,
  host: () => MatchMediaHost | undefined = () =>
    typeof window === "undefined" ? undefined : window
) {
  return {
    subscribe(onChange: () => void) {
      const mql = host()?.matchMedia(query)
      if (!mql) return () => {}
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    },
    getSnapshot(): boolean {
      return host()?.matchMedia(query).matches ?? false
    },
    getServerSnapshot(): boolean {
      return false
    },
  }
}

/**
 * SSR-safe media query. The server snapshot (and so the hydration render) is
 * always `false`, then React re-renders with the real value. Use CSS
 * breakpoints for anything that must be right on first paint; use this only
 * for behaviour, e.g. mounting the preview inline vs. inside a Sheet.
 */
export function useMediaQuery(query: string): boolean {
  const store = useMemo(() => createMediaQueryStore(query), [query])
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  )
}

/** ≥ 1280px wide (Tailwind `xl`). False on the server and during hydration. */
export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_MEDIA_QUERY)
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)")
}

export default useMediaQuery
