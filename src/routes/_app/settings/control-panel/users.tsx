import { createFileRoute, redirect } from '@tanstack/react-router'

/** Control Panel → Users is Settings → System Users. */
export const Route = createFileRoute('/_app/settings/control-panel/users')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/system-users', replace: true })
  },
})
