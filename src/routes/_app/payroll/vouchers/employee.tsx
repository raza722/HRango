import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { EmployeeVouchersPage, PAGE_SEARCH_DEFAULTS, pageSearchSchema } from '@/features/payroll'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/payroll/vouchers/employee')({
  validateSearch: pageSearchSchema,
  search: { middlewares: [stripSearchParams(PAGE_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Employee Voucher') }] }),
  component: EmployeeVouchersPage,
})
