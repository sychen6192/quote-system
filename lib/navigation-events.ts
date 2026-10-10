/**
 * Fired (cancelable) on window before code-driven navigations that bypass
 * links, e.g. the language switcher's router.replace. A page with unsaved
 * edits calls preventDefault() and shows its own "leave?" dialog, then
 * navigates to detail.href itself if the user confirms.
 */
export const BEFORE_NAVIGATE_EVENT = "qs:before-navigate";

export type BeforeNavigateDetail = { href: string };

/** Returns false when a listener vetoed the navigation. */
export function requestNavigation(href: string): boolean {
  return window.dispatchEvent(
    new CustomEvent<BeforeNavigateDetail>(BEFORE_NAVIGATE_EVENT, {
      cancelable: true,
      detail: { href },
    })
  );
}
