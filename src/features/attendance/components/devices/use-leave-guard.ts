import { useBlocker } from '@tanstack/react-router'

const tabOf = (search: unknown) =>
  (search as { tab?: unknown } | undefined)?.tab === 'import' ? 'import' : 'enrolments'
const deviceOf = (search: unknown) => (search as { device?: unknown } | undefined)?.device

/**
 * Asks before unsaved enrolments are lost. The app's `useUnsavedChangesGuard` only watches the
 * path; a device's tabs and the way back to the list are search params of the same path
 * (`?device=…&tab=…`), so this one blocks those too, and closing or reloading the tab.
 */
export function useLeaveGuard(isDirty: boolean) {
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      isDirty &&
      (current.pathname !== next.pathname ||
        deviceOf(current.search) !== deviceOf(next.search) ||
        tabOf(current.search) !== tabOf(next.search)),
    enableBeforeUnload: () => isDirty,
    withResolver: true,
  })
  return {
    isBlocked: blocker.status === 'blocked',
    proceed: () => {
      blocker.proceed?.()
    },
    stay: () => {
      blocker.reset?.()
    },
  }
}
