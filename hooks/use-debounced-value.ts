import { useEffect, useLayoutEffect, useState } from "react"

/** `value`, updated only after it has stopped changing for `delayMs`. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

export interface Debounced<Args extends unknown[]> {
  (...args: Args): void
  /** Drop the pending call. */
  cancel(): void
  /** Run the pending call now (no-op if none), e.g. on pagehide. */
  flush(): void
  isPending(): boolean
}

/**
 * Trailing-edge debounce with cancel/flush; framework-free. `delayMs` may be a
 * getter, read on every call.
 */
export function createDebounced<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number | (() => number)
): Debounced<Args> {
  const delay = typeof delayMs === "function" ? delayMs : () => delayMs
  let timer: ReturnType<typeof setTimeout> | undefined
  let pendingArgs: Args | undefined

  const run = () => {
    const args = pendingArgs
    timer = undefined
    pendingArgs = undefined
    if (args) fn(...args)
  }

  const debounced = ((...args: Args) => {
    pendingArgs = args
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(run, delay())
  }) as Debounced<Args>

  debounced.cancel = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    pendingArgs = undefined
  }
  debounced.flush = () => {
    if (timer === undefined) return
    clearTimeout(timer)
    run()
  }
  debounced.isPending = () => timer !== undefined

  return debounced
}

export interface UseDebouncedCallbackOptions {
  /** Run a pending call on unmount instead of dropping it (autosave). */
  flushOnUnmount?: boolean
}

type DebouncedTarget<Args extends unknown[]> = {
  fn: (...args: Args) => void
  delayMs: number
  flushOnUnmount: boolean
}

/** A debouncer whose target can be swapped without changing its identity. */
function createRetargetableDebounced<Args extends unknown[]>(
  initial: DebouncedTarget<Args>
) {
  let target = initial
  const debounced = createDebounced<Args>(
    (...args) => target.fn(...args),
    () => target.delayMs
  )
  return {
    debounced,
    retarget(next: DebouncedTarget<Args>) {
      target = next
    },
    dispose() {
      if (target.flushOnUnmount) debounced.flush()
      else debounced.cancel()
    },
  }
}

/**
 * Stable debounced wrapper that always calls the latest `fn` with the latest
 * `delayMs`. Pending calls are cancelled on unmount unless `flushOnUnmount`.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs = 300,
  { flushOnUnmount = false }: UseDebouncedCallbackOptions = {}
): Debounced<Args> {
  // Created during the first render rather than in an effect: children's
  // effects and the caller's layout effects run before this hook's passive
  // effects, and a call made then would otherwise be dropped.
  const [controller] = useState(() =>
    createRetargetableDebounced<Args>({ fn, delayMs, flushOnUnmount })
  )

  useLayoutEffect(() => {
    controller.retarget({ fn, delayMs, flushOnUnmount })
  })

  useEffect(() => () => controller.dispose(), [controller])

  return controller.debounced
}

export default useDebouncedValue
