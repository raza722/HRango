import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  EmployeeAccountReportPage,
  REPORT_SEARCH_DEFAULTS,
  reportSearchSchema,
} from '@/features/payroll'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/payroll/reports/employee-accounts')({
  validateSearch: reportSearchSchema,
  search: { middlewares: [stripSearchParams(REPORT_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Employee Account Report') }] }),
  component: EmployeeAccountReportPage,
})
