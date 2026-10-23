import { createFileRoute, redirect } from '@tanstack/react-router'

/** Requests → Settings opens on Request Restriction, the first of its pages. */
export const Route = createFileRoute('/_app/requests/settings/')({
  beforeLoad: () => {
    throw redirect({ to: '/requests/settings/restrictions', replace: true })
  },
})
