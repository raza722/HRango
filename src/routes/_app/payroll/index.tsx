import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/payroll/')({
  beforeLoad: () => {
    throw redirect({ to: '/payroll/dashboard', replace: true })
  },
})
