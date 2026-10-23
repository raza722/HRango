import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { AssetAllocationsPage } from '@/features/assets'
import { PAGE_SEARCH_DEFAULTS, pageSearchSchema } from '@/features/payroll'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/assets/allocations')({
  validateSearch: pageSearchSchema,
  search: { middlewares: [stripSearchParams(PAGE_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Asset Allocations') }] }),
  component: AssetAllocationsPage,
})
