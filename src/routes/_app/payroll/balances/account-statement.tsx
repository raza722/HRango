import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { AccountStatementPage, PAGE_SEARCH_DEFAULTS, pageSearchSchema } from '@/features/payroll'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/payroll/balances/account-statement')({
  validateSearch: pageSearchSchema,
  search: { middlewares: [stripSearchParams(PAGE_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Employee Account Statement') }] }),
  component: AccountStatementPage,
})
