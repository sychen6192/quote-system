import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

/**
 * false on the server and during hydration, true afterwards — without the
 * extra effect-and-setState render of the useEffect version. Gate
 * browser-only UI (theme icons, locale-formatted "2 min ago") on it.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
}

export default useMounted
