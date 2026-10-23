import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { PAGE_SEARCH_DEFAULTS, pageSearchSchema, SalaryRevisionPage } from '@/features/payroll'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/payroll/salary-revision')({
  validateSearch: pageSearchSchema,
  search: { middlewares: [stripSearchParams(PAGE_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Salary Revision') }] }),
  component: SalaryRevisionPage,
})
