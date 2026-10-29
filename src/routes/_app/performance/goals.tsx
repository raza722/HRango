import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { GOALS_SEARCH_DEFAULTS, GoalsPage, goalsSearchSchema } from '@/features/performance'
import { pageTitle } from '@/lib/constants'

/** Performance → Goals: My / Team / All goals with their check-ins. */
export const Route = createFileRoute('/_app/performance/goals')({
  validateSearch: goalsSearchSchema,
  search: { middlewares: [stripSearchParams(GOALS_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Goals') }] }),
  component: GoalsPage,
})
