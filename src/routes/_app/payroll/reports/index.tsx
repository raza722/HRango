import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/payroll/reports/')({
  beforeLoad: () => {
    throw redirect({ to: '/payroll/reports/employee-accounts', replace: true })
  },
})
