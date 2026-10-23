import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  SCHEDULING_SEARCH_DEFAULTS,
  SchedulingPage,
  schedulingSearchSchema,
} from '@/features/scheduling'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/scheduling')({
  validateSearch: schedulingSearchSchema,
  search: { middlewares: [stripSearchParams(SCHEDULING_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Scheduling') }] }),
  component: SchedulingPage,
})
