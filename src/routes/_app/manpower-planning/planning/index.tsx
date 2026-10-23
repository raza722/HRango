import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { PlanningPage } from '@/features/manpower-planning'
import { PAGE_SEARCH_DEFAULTS, pageSearchSchema } from '@/features/payroll'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/manpower-planning/planning/')({
  validateSearch: pageSearchSchema,
  search: { middlewares: [stripSearchParams(PAGE_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Planning') }] }),
  component: PlanningPage,
})
