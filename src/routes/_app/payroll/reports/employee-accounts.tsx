import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  EmployeeAccountReportPage,
  PAGE_SEARCH_DEFAULTS,
  pageSearchSchema,
} from '@/features/payroll'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/payroll/reports/employee-accounts')({
  validateSearch: pageSearchSchema,
  search: { middlewares: [stripSearchParams(PAGE_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Employee Account Report') }] }),
  component: EmployeeAccountReportPage,
})
