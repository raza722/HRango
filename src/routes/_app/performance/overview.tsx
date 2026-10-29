import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  OVERVIEW_SEARCH_DEFAULTS,
  OverviewPage,
  overviewSearchSchema,
} from '@/features/performance'
import { pageTitle } from '@/lib/constants'

/** Performance → Overview: goals, the current appraisal and ratings of a person. */
export const Route = createFileRoute('/_app/performance/overview')({
  validateSearch: overviewSearchSchema,
  search: { middlewares: [stripSearchParams(OVERVIEW_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Performance Overview') }] }),
  component: OverviewPage,
})
