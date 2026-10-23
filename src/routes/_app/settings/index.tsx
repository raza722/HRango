import { createFileRoute, redirect } from '@tanstack/react-router'

/** "Settings" has no page of its own; the Control Panel is its main screen. */
export const Route = createFileRoute('/_app/settings/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/control-panel', replace: true })
  },
})
