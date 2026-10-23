import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/leaves/settings/')({
  beforeLoad: () => {
    throw redirect({ to: '/leaves/settings/general', replace: true })
  },
})
