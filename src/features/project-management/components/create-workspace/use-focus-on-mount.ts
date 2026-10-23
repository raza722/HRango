import { type RefObject, useEffect, useRef } from 'react'

/**
 * A ref that focuses its element once it mounts (when `enabled`), so moving between the wizard's
 * steps and pages takes keyboard and screen reader users to the new heading.
 */
export function useFocusOnMount<T extends HTMLElement>(enabled: boolean): RefObject<T | null> {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (enabled) ref.current?.focus()
  }, [enabled])
  return ref
}
