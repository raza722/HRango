import { createFileRoute } from '@tanstack/react-router'

import { PayrollDashboardPage } from '@/features/payroll'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/payroll/dashboard')({
  head: () => ({ meta: [{ title: pageTitle('Payroll Dashboard') }] }),
  component: PayrollDashboardPage,
})
