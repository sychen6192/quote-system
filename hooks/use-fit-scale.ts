// Adapted from Invoify (https://github.com/al1abb/invoify), MIT License, Copyright (c) 2023 Ali Abbasov.

import { useCallback, useEffect, useLayoutEffect, useState } from "react"

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect

export interface FitScaleInput {
  /** Width the content may occupy: the pane's content box. */
  availableWidth: number
  /** Unscaled layout width of the content (offsetWidth). */
  contentWidth: number
  /** false = 100% mode. */
  enabled?: boolean
  /** Floor below which the pane scrolls instead of shrinking further. */
  minScale?: number
}

/**
 * Fit-to-width: never scales up, so a short page on a wide screen stays at
 * 100%. Returns 1 until both widths are known.
 */
export function computeFitScale({
  availableWidth,
  contentWidth,
  enabled = true,
  minScale = 0,
}: FitScaleInput): number {
  if (!enabled || !(availableWidth > 0) || !(contentWidth > 0)) return 1
  const fit = Math.min(1, availableWidth / contentWidth)
  // Rounded so sub-pixel ResizeObserver noise does not cause re-renders.
  return Math.max(minScale, Math.floor(fit * 10000) / 10000)
}

/** clientWidth minus horizontal padding. */
export function paneContentWidth(pane: HTMLElement): number {
  const style = getComputedStyle(pane)
  const padding =
    (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
  return pane.clientWidth - padding
}

export interface UseFitScaleOptions {
  enabled?: boolean
  minScale?: number
}

/**
 * Scales fixed-width content (the 210mm A4 sheet) down to the width of its
 * pane. The content must have an intrinsic width (not w-full). Typical use:
 *
 *   <div ref={paneRef} className="overflow-hidden [scrollbar-gutter:stable]">
 *     <div style={{ height: scaledHeight, width: scaledWidth }}>
 *       <div ref={contentRef} className="w-[210mm] origin-top-left print:transform-none"
 *            style={{ transform: `scale(${scale})` }}>…</div>
 *     </div>
 *   </div>
 *
 * The refs are callback refs (no `.current`), so content mounted later — e.g.
 * behind next/dynamic — is still observed. `ready` is false until the first
 * measurement; hide the content until then to avoid a flash at 100%.
 */
export function useFitScale<
  Pane extends HTMLElement = HTMLDivElement,
  Content extends HTMLElement = HTMLDivElement,
>({ enabled = true, minScale = 0 }: UseFitScaleOptions = {}) {
  const [pane, setPane] = useState<Pane | null>(null)
  const [content, setContent] = useState<Content | null>(null)
  const [size, setSize] = useState({ available: 0, width: 0, height: 0 })

  const measure = useCallback(() => {
    if (!pane || !content) return
    // offset*, not getBoundingClientRect: the rect is the *scaled* box and
    // would feed the scale back into its own measurement.
    const next = {
      available: paneContentWidth(pane),
      width: content.offsetWidth,
      height: content.offsetHeight,
    }
    setSize((prev) =>
      prev.available === next.available &&
      prev.width === next.width &&
      prev.height === next.height
        ? prev
        : next
    )
  }, [pane, content])

  useIsomorphicLayoutEffect(() => {
    if (!pane || !content) return
    measure()
    // Both: the pane changes with the window, the content as the quote grows.
    const observer = new ResizeObserver(measure)
    observer.observe(pane)
    observer.observe(content)
    return () => observer.disconnect()
  }, [pane, content, measure])

  const scale = computeFitScale({
    availableWidth: size.available,
    contentWidth: size.width,
    enabled,
    minScale,
  })
  const ready = size.width > 0

  return {
    paneRef: setPane,
    contentRef: setContent,
    scale,
    /** Height the scaled content occupies; set it on the wrapper. */
    scaledHeight: ready ? size.height * scale : undefined,
    scaledWidth: ready ? size.width * scale : undefined,
    ready,
    remeasure: measure,
  }
}

export default useFitScale
