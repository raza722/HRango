import { useEffect, useState } from 'react'

/** Pause after the last keystroke before a search runs: one value for every search in the app. */
export const SEARCH_DEBOUNCE_MS = 300

/** `value`, but only after it has stopped changing for `delayMs` (for search-as-you-type). */
export function useDebouncedValue<T>(value: T, delayMs = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(value)
    }, delayMs)
    return () => {
      window.clearTimeout(timer)
    }
  }, [value, delayMs])

  return debounced
}
