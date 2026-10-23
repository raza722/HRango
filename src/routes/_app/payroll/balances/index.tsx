import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/payroll/balances/')({
  beforeLoad: () => {
    throw redirect({ to: '/payroll/balances/opening-balance', replace: true })
  },
})
