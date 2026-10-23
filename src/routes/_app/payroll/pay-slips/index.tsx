import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/payroll/pay-slips/')({
  beforeLoad: () => {
    throw redirect({ to: '/payroll/pay-slips/my', replace: true })
  },
})
