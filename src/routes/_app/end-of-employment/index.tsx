import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/end-of-employment/')({
  beforeLoad: () => {
    throw redirect({ to: '/end-of-employment/all', replace: true })
  },
})
