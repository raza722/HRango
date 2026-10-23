import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { PAGE_SEARCH_DEFAULTS, pageSearchSchema, VouchersPage } from '@/features/payroll'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/payroll/vouchers/')({
  validateSearch: pageSearchSchema,
  search: { middlewares: [stripSearchParams(PAGE_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Vouchers') }] }),
  component: VouchersPage,
})
