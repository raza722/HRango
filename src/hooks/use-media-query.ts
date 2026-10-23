import { useCallback, useSyncExternalStore } from 'react'

/**
 * Subscribes to a CSS media query and returns whether it currently matches.
 * Uses `useSyncExternalStore`, so it never renders a stale value.
 *
 * @example const isDesktop = useMediaQuery(BREAKPOINTS.desktop)
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => {
        list.removeEventListener('change', onChange)
      }
    },
    [query],
  )

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Breakpoints shared by layout code; keep in sync with Tailwind's `sm`, `md` and `lg`. */
export const BREAKPOINTS = {
  sm: '(min-width: 640px)',
  /** Tables switch from stacked cards to columns here. */
  md: '(min-width: 768px)',
  /** The sidebar stops being a drawer here. */
  desktop: '(min-width: 1024px)',
} as const
