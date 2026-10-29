import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { CYCLES_SEARCH_DEFAULTS, CyclesPage, cyclesSearchSchema } from '@/features/performance'
import { pageTitle } from '@/lib/constants'

/** Performance → Review Cycles: cycles, participants, launch and close. */
export const Route = createFileRoute('/_app/performance/cycles')({
  validateSearch: cyclesSearchSchema,
  search: { middlewares: [stripSearchParams(CYCLES_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Review Cycles') }] }),
  component: CyclesPage,
})
