import { useEffect, useEffectEvent, useSyncExternalStore } from "react"

export interface Hotkey {
  /** Lower-case `KeyboardEvent.key` ("s", "escape", "/", " "). */
  key: string
  /** ⌘ on Apple platforms, Ctrl elsewhere. */
  mod: boolean
  ctrl: boolean
  meta: boolean
  alt: boolean
  shift: boolean
}

export type HotkeyEvent = Pick<
  KeyboardEvent,
  "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
>

const MODIFIERS: Record<string, keyof Omit<Hotkey, "key">> = {
  mod: "mod",
  ctrl: "ctrl",
  control: "ctrl",
  meta: "meta",
  cmd: "meta",
  command: "meta",
  alt: "alt",
  option: "alt",
  opt: "alt",
  shift: "shift",
}

const KEY_ALIASES: Record<string, string> = {
  esc: "escape",
  return: "enter",
  space: " ",
  spacebar: " ",
  plus: "+",
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
  del: "delete",
}

/** "mod+shift+s" → Hotkey. Throws on an empty or multi-key combo. */
export function parseHotkey(combo: string): Hotkey {
  const raw = combo.trim().toLowerCase()
  // "ctrl++" means Ctrl and the "+" key.
  const parts = raw.endsWith("++")
    ? [...raw.slice(0, -2).split("+"), "+"]
    : raw === "+"
      ? ["+"]
      : raw.split("+")

  const hotkey: Hotkey = {
    key: "",
    mod: false,
    ctrl: false,
    meta: false,
    alt: false,
    shift: false,
  }
  for (const part of parts.map((p) => p.trim())) {
    const modifier = MODIFIERS[part]
    if (modifier) {
      hotkey[modifier] = true
    } else if (hotkey.key || !part) {
      throw new Error(`Invalid hotkey "${combo}"`)
    } else {
      hotkey.key = KEY_ALIASES[part] ?? part
    }
  }
  if (!hotkey.key) throw new Error(`Invalid hotkey "${combo}"`)
  return hotkey
}

const ALPHANUMERIC = /^[a-z0-9]$/
const PRINTABLE_ASCII = /^[\x20-\x7e]$/

function keyMatches(event: HotkeyEvent, key: string): boolean {
  if (event.key.toLowerCase() === key) return true
  // Option/Alt and non-Latin layouts turn "s" into "ß" or "ы"; fall back to the
  // physical key then. Only then: on AZERTY, code "KeyA" is the key printed "Q".
  if (ALPHANUMERIC.test(key) && !PRINTABLE_ASCII.test(event.key)) {
    const physical = /^(?:Key|Digit)(.)$/.exec(event.code)?.[1]
    return physical?.toLowerCase() === key
  }
  return false
}

/**
 * Exact modifier match: "mod+s" does not fire on Ctrl+Shift+S. Shift is
 * ignored for punctuation keys unless asked for, because "?" already implies
 * Shift on most layouts.
 */
export function matchesHotkey(
  event: HotkeyEvent,
  hotkey: Hotkey | string,
  isApple = false
): boolean {
  // Chrome autofill dispatches bare keydown Events without `key`.
  if (typeof event.key !== "string") return false
  const hk = typeof hotkey === "string" ? parseHotkey(hotkey) : hotkey
  const wantCtrl = hk.ctrl || (hk.mod && !isApple)
  const wantMeta = hk.meta || (hk.mod && isApple)
  if (event.ctrlKey !== wantCtrl) return false
  if (event.metaKey !== wantMeta) return false
  if (event.altKey !== hk.alt) return false
  const shiftAgnostic =
    !hk.shift &&
    hk.key.length === 1 &&
    hk.key !== " " &&
    !ALPHANUMERIC.test(hk.key)
  if (!shiftAgnostic && event.shiftKey !== hk.shift) return false
  return keyMatches(event, hk.key)
}

/** IME composition (Zhuyin, Pinyin…): the keystroke belongs to the IME. */
export function isComposing(
  event: Pick<KeyboardEvent, "isComposing" | "keyCode">
): boolean {
  return event.isComposing || event.keyCode === 229
}

const NON_TEXT_INPUTS = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
])

/** True when typing into `target` would produce text. */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as {
    tagName?: string
    type?: string
    isContentEditable?: boolean
  } | null
  if (!el || typeof el.tagName !== "string") return false
  if (el.isContentEditable) return true
  const tag = el.tagName.toUpperCase()
  if (tag === "TEXTAREA" || tag === "SELECT") return true
  return tag === "INPUT" && !NON_TEXT_INPUTS.has((el.type ?? "").toLowerCase())
}

type NavigatorLike = {
  platform?: string
  userAgent?: string
  userAgentData?: { platform?: string }
}

export function isApplePlatform(nav?: NavigatorLike): boolean {
  const n: NavigatorLike | undefined =
    nav ?? (typeof navigator === "undefined" ? undefined : navigator)
  if (!n) return false
  const platform = n.userAgentData?.platform || n.platform || n.userAgent || ""
  return /mac|iphone|ipad|ipod/i.test(platform)
}

const noopSubscribe = () => () => {}

/** false on the server and during hydration. */
export function useIsApplePlatform(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => isApplePlatform(),
    () => false
  )
}

const APPLE_SYMBOLS = { ctrl: "⌃", alt: "⌥", shift: "⇧", meta: "⌘" }

const KEY_LABELS: Record<string, string> = {
  " ": "Space",
  escape: "Esc",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
}

/** "mod+shift+s" → "⌘⇧S" (Apple, HIG order ⌃⌥⇧⌘) or "Ctrl+Shift+S". */
export function formatHotkey(combo: string, isApple = false): string {
  const hk = parseHotkey(combo)
  const ctrl = hk.ctrl || (hk.mod && !isApple)
  const meta = hk.meta || (hk.mod && isApple)
  const key =
    KEY_LABELS[hk.key] ??
    (hk.key.length === 1
      ? hk.key.toUpperCase()
      : hk.key.charAt(0).toUpperCase() + hk.key.slice(1))

  if (isApple) {
    return (
      (ctrl ? APPLE_SYMBOLS.ctrl : "") +
      (hk.alt ? APPLE_SYMBOLS.alt : "") +
      (hk.shift ? APPLE_SYMBOLS.shift : "") +
      (meta ? APPLE_SYMBOLS.meta : "") +
      key
    )
  }
  return [
    ctrl && "Ctrl",
    meta && "Meta",
    hk.alt && "Alt",
    hk.shift && "Shift",
    key,
  ]
    .filter(Boolean)
    .join("+")
}

export interface UseHotkeyOptions {
  enabled?: boolean
  /** Default true, so mod+s does not open the browser's Save dialog. */
  preventDefault?: boolean
  /**
   * Fire while typing in an input/textarea/contenteditable. Defaults to true
   * for combos with Ctrl/⌘/Alt and false for bare keys like "/" or "n".
   */
  enableOnEditable?: boolean
  /** Fire on auto-repeat while the key is held (default false). */
  allowRepeat?: boolean
}

/**
 * Global keydown shortcut(s) on window, e.g. useHotkey("mod+s", save).
 * Ignores IME composition. Listens in the bubble phase, so a focused widget
 * that handles the key itself (Escape in a dialog) wins.
 */
export function useHotkey(
  hotkeys: string | readonly string[],
  handler: (event: KeyboardEvent) => void,
  {
    enabled = true,
    preventDefault = true,
    enableOnEditable,
    allowRepeat = false,
  }: UseHotkeyOptions = {}
): void {
  const onHotkey = useEffectEvent(handler)
  // A string key keeps the effect stable when callers pass an inline array.
  const combos = (typeof hotkeys === "string" ? [hotkeys] : hotkeys).join("\n")

  useEffect(() => {
    if (!enabled) return
    const parsed = combos.split("\n").map(parseHotkey)
    const apple = isApplePlatform()

    const listener = (event: KeyboardEvent) => {
      if (isComposing(event)) return
      const hit = parsed.find((hk) => matchesHotkey(event, hk, apple))
      if (!hit) return
      const hasModifier = hit.mod || hit.ctrl || hit.meta || hit.alt
      if (
        isEditableTarget(event.target) &&
        !(enableOnEditable ?? hasModifier)
      ) {
        return
      }
      if (preventDefault) event.preventDefault()
      if (event.repeat && !allowRepeat) return
      onHotkey(event)
    }

    window.addEventListener("keydown", listener)
    return () => window.removeEventListener("keydown", listener)
  }, [combos, enabled, preventDefault, enableOnEditable, allowRepeat])
}

export default useHotkey
