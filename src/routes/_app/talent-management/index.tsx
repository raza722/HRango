import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/talent-management/')({
  beforeLoad: () => {
    throw redirect({ to: '/talent-management/employees', replace: true })
  },
})
