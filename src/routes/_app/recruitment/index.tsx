import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/recruitment/')({
  beforeLoad: () => {
    throw redirect({ to: '/recruitment/dashboard', replace: true })
  },
})
