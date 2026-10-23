import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/leaves/')({
  beforeLoad: () => {
    throw redirect({ to: '/leaves/my-leaves', replace: true })
  },
})
