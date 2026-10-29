import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/performance/')({
  beforeLoad: () => {
    throw redirect({ to: '/performance/overview', replace: true })
  },
})
