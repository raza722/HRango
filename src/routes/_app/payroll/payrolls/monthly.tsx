import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { MonthlyPayrollPage, PAGE_SEARCH_DEFAULTS, pageSearchSchema } from '@/features/payroll'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/payroll/payrolls/monthly')({
  validateSearch: pageSearchSchema,
  search: { middlewares: [stripSearchParams(PAGE_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Payrolls Monthly') }] }),
  component: MonthlyPayrollPage,
})
