import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { OpeningBalancePage, PAGE_SEARCH_DEFAULTS, pageSearchSchema } from '@/features/payroll'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/payroll/balances/opening-balance')({
  validateSearch: pageSearchSchema,
  search: { middlewares: [stripSearchParams(PAGE_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Opening Balance') }] }),
  component: OpeningBalancePage,
})
