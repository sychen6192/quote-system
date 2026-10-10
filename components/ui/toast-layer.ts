// Toasts render outside every dialog. While a modal dialog or sheet is open,
// a click on a toast's action (Undo, Retry, Reload) is an "outside"
// interaction that would close the dialog: these helpers keep it open.

/** A toast, or anything inside sonner's toaster. */
export function isToastTarget(target: EventTarget | null): boolean {
  return (
    typeof Element !== "undefined" &&
    target instanceof Element &&
    target.closest("[data-sonner-toaster]") !== null
  )
}

/** Wraps a dialog's onInteractOutside: interactions with toasts don't dismiss it. */
export function ignoreToastInteractions<E extends { target: EventTarget | null; preventDefault(): void }>(
  handler?: (event: E) => void
): (event: E) => void {
  return (event) => {
    if (isToastTarget(event.target)) {
      event.preventDefault()
      return
    }
    handler?.(event)
  }
}

/** How long a toast with an action (Undo, Retry…) stays: long enough to read and reach. */
export const ACTION_TOAST_DURATION_MS = 10_000
