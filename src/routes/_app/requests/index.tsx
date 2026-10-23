import { createFileRoute, redirect } from '@tanstack/react-router'

/** "Requests" opens on Punch, the first type in the menu. */
export const Route = createFileRoute('/_app/requests/')({
  beforeLoad: () => {
    throw redirect({ to: '/requests/punch', replace: true })
  },
})
