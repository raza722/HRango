import { useRef } from 'react'
import { useBlocker } from '@tanstack/react-router'

/**
 * Asks before leaving a page with unsaved changes: in-app navigation shows the
 * returned dialog state, closing or reloading the tab shows the browser prompt.
 * Call `allowNextNavigation()` just before navigating away on purpose (after a save).
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  const allowRef = useRef(false)

  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      isDirty && !allowRef.current && current.pathname !== next.pathname,
    enableBeforeUnload: () => isDirty && !allowRef.current,
    withResolver: true,
  })

  return {
    /** True while the "Discard changes?" dialog should be open. */
    isBlocked: blocker.status === 'blocked',
    /** Leave the page and drop the changes. */
    proceed: () => {
      blocker.proceed?.()
    },
    /** Stay on the page. */
    stay: () => {
      blocker.reset?.()
    },
    allowNextNavigation: () => {
      allowRef.current = true
    },
  }
}
