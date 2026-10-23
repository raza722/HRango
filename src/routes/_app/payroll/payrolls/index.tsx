import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/payroll/payrolls/')({
  beforeLoad: () => {
    throw redirect({ to: '/payroll/payrolls/monthly', replace: true })
  },
})
