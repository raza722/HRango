import { useCallback, useState } from 'react'

/**
 * Measures an element's content width and keeps it current with a
 * ResizeObserver. Returns a callback ref to attach and the width in px
 * (`undefined` until the first measurement, e.g. during SSR or in jsdom).
 *
 * Prefer CSS container queries for pure layout; use this when logic depends
 * on the space available (how many chips fit in a carousel).
 *
 * @example const [ref, width] = useElementWidth(); <div ref={ref} />
 */
export function useElementWidth(): [
  ref: (node: HTMLElement | null) => (() => void) | undefined,
  width: number | undefined,
] {
  const [width, setWidth] = useState<number>()

  const ref = useCallback((node: HTMLElement | null) => {
    if (!node || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width))
    })
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [])

  return [ref, width]
}
