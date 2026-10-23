import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { FinalSettlementPage, PAGE_SEARCH_DEFAULTS, pageSearchSchema } from '@/features/payroll'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/payroll/final-settlement')({
  validateSearch: pageSearchSchema,
  search: { middlewares: [stripSearchParams(PAGE_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Final Settlement') }] }),
  component: FinalSettlementPage,
})
