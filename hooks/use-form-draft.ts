// Adapted from Invoify (https://github.com/al1abb/invoify), MIT License, Copyright (c) 2023 Ali Abbasov.
//
// Draft autosave for long forms: the latest values are parked and written to
// localStorage on a trailing debounce, and flushed when the page is hidden
// (pagehide / visibilitychange — not `unload`, which mobile Safari ignores)
// or the form unmounts. A draft is a convenience, never a guarantee: every
// storage call is wrapped, and a failed write reports "error", not "saved".

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { useDebouncedCallback } from "@/hooks/use-debounced-value"
import { useMounted } from "@/hooks/use-mounted"

export const DRAFT_VERSION = 1

export type StoredDraft<T> = { version: typeof DRAFT_VERSION; savedAt: number; values: T }

export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem"> &
  Partial<Pick<Storage, "key" | "length">>

/** window.localStorage, or null where it is unavailable (SSR, blocked cookies). */
export function getDraftStorage(): DraftStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

export function readDraft<T>(storage: DraftStorage | null, key: string): StoredDraft<T> | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredDraft<T>> | null
    if (
      !parsed ||
      parsed.version !== DRAFT_VERSION ||
      typeof parsed.savedAt !== "number" ||
      !Number.isFinite(parsed.savedAt) ||
      typeof parsed.values !== "object" ||
      parsed.values === null
    ) {
      return null
    }
    return parsed as StoredDraft<T>
  } catch {
    return null
  }
}

/** false on quota errors, disabled storage or unserialisable values. */
export function writeDraft<T>(
  storage: DraftStorage | null,
  key: string,
  values: T,
  savedAt: number
): boolean {
  if (!storage) return false
  try {
    const draft: StoredDraft<T> = { version: DRAFT_VERSION, savedAt, values }
    storage.setItem(key, JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

export function removeDraft(storage: DraftStorage | null, key: string): void {
  try {
    storage?.removeItem(key)
  } catch {
    // Nothing useful to do; the draft simply stays.
  }
}

/** Removes every key starting with `prefix` except `keep` (stale edit drafts). */
export function pruneDrafts(storage: DraftStorage | null, prefix: string, keep: string): void {
  if (!storage || typeof storage.key !== "function") return
  try {
    const stale: string[] = []
    const length = storage.length ?? 0
    for (let i = 0; i < length; i++) {
      const key = storage.key(i)
      if (key && key.startsWith(prefix) && key !== keep) stale.push(key)
    }
    stale.forEach((key) => removeDraft(storage, key))
  } catch {
    // Enumeration can throw when storage is blocked mid-session.
  }
}

function normalize(value: unknown): unknown {
  if (value === null || value === undefined) return ""
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "boolean") return value
  if (Array.isArray(value)) return value.map(normalize)
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const child = normalize((value as Record<string, unknown>)[key])
      if (child !== "") out[key] = child
    }
    return out
  }
  return ""
}

/**
 * Comparable form snapshot: key order, number-vs-string inputs ("1" and 1),
 * surrounding whitespace and empty-vs-missing fields don't count as changes.
 */
export function draftFingerprint(values: unknown): string {
  return JSON.stringify(normalize(values))
}

export function draftDiffers(a: unknown, b: unknown): boolean {
  return draftFingerprint(a) !== draftFingerprint(b)
}

export type DraftStatus = "idle" | "pending" | "saved" | "error"
export type DraftStatusSnapshot = { status: DraftStatus; savedAt: number | null }

export type DraftStatusStore = {
  get(): DraftStatusSnapshot
  set(next: DraftStatusSnapshot): void
  subscribe(listener: () => void): () => void
}

const IDLE: DraftStatusSnapshot = { status: "idle", savedAt: null }

/**
 * Autosave status lives outside React state so only the indicator
 * re-renders when it changes, not the whole form.
 */
export function createDraftStatusStore(): DraftStatusStore {
  let snapshot = IDLE
  const listeners = new Set<() => void>()
  return {
    get: () => snapshot,
    set(next) {
      if (next.status === snapshot.status && next.savedAt === snapshot.savedAt) return
      snapshot = next
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export function useDraftStatus(store: DraftStatusStore): DraftStatusSnapshot {
  return useSyncExternalStore(store.subscribe, store.get, () => IDLE)
}

export type UseFormDraftOptions<T> = {
  /** localStorage key, e.g. qs:draft:new */
  key: string
  /** Calls back with the latest values on every change; returns an unsubscribe. Must be stable. */
  subscribe: (onChange: (values: T) => void) => () => void
  /** What the form started from: a stored draft equal to it is not offered for restore. */
  initialValues: T
  debounceMs?: number
  /** Drafts with this prefix other than `key` are deleted on mount (older versions of the same record). */
  prunePrefix?: string
}

export type UseFormDraftResult<T> = {
  statusStore: DraftStatusStore
  /** A draft found on mount that differs from the initial values, until restored or discarded. */
  restorable: StoredDraft<T> | null
  /** Returns the draft's values (the caller resets the form with them). */
  restore(): T | null
  discard(): void
  /** After a successful save: drop the draft and stop autosaving. */
  clear(): void
  /** Write any pending change now (before a reload). */
  flush(): void
}

export function useFormDraft<T>({
  key,
  subscribe,
  initialValues,
  debounceMs = 600,
  prunePrefix,
}: UseFormDraftOptions<T>): UseFormDraftResult<T> {
  const [statusStore] = useState(createDraftStatusStore)
  const pendingRef = useRef<{ values: T } | null>(null)
  const stoppedRef = useRef(false)
  const [decided, setDecided] = useState(false)

  // Read once after hydration, before any autosave can overwrite it; the
  // server render and the hydration pass both see "no draft".
  const mounted = useMounted()
  const found = useMemo(
    () => (mounted ? readDraft<T>(getDraftStorage(), key) : null),
    [mounted, key]
  )
  const [initialFingerprint] = useState(() => draftFingerprint(initialValues))
  const restorable =
    !decided && found && draftFingerprint(found.values) !== initialFingerprint ? found : null

  const flush = useCallback(() => {
    const pending = pendingRef.current
    if (!pending || stoppedRef.current) return
    pendingRef.current = null
    const savedAt = Date.now()
    const ok = writeDraft(getDraftStorage(), key, pending.values, savedAt)
    statusStore.set(ok ? { status: "saved", savedAt } : { status: "error", savedAt: null })
  }, [key, statusStore])

  const schedule = useDebouncedCallback(flush, debounceMs)

  useEffect(() => {
    if (prunePrefix) pruneDrafts(getDraftStorage(), prunePrefix, key)
  }, [prunePrefix, key])

  useEffect(() => {
    const unsubscribe = subscribe((values) => {
      if (stoppedRef.current) return
      pendingRef.current = { values }
      statusStore.set({ status: "pending", savedAt: statusStore.get().savedAt })
      schedule()
    })
    const onPageHide = () => flush()
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush()
    }
    window.addEventListener("pagehide", onPageHide)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      unsubscribe()
      window.removeEventListener("pagehide", onPageHide)
      document.removeEventListener("visibilitychange", onVisibility)
      schedule.cancel()
      flush()
    }
  }, [subscribe, schedule, flush, statusStore])

  const restore = useCallback((): T | null => {
    setDecided(true)
    return found ? found.values : null
  }, [found])

  const discard = useCallback(() => {
    setDecided(true)
    const storage = getDraftStorage()
    // Only the draft that was offered: edits made since then are newer.
    if (found && readDraft(storage, key)?.savedAt === found.savedAt) removeDraft(storage, key)
  }, [found, key])

  const clear = useCallback(() => {
    stoppedRef.current = true
    pendingRef.current = null
    schedule.cancel()
    removeDraft(getDraftStorage(), key)
    statusStore.set(IDLE)
  }, [key, schedule, statusStore])

  return useMemo(
    () => ({ statusStore, restorable, restore, discard, clear, flush }),
    [statusStore, restorable, restore, discard, clear, flush]
  )
}

export default useFormDraft
