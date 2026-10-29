import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { KPIS_SEARCH_DEFAULTS, KpisPage, kpisSearchSchema } from '@/features/performance'
import { pageTitle } from '@/lib/constants'

/** Performance → KPIs: the KPI library. */
export const Route = createFileRoute('/_app/performance/kpis')({
  validateSearch: kpisSearchSchema,
  search: { middlewares: [stripSearchParams(KPIS_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('KPIs') }] }),
  component: KpisPage,
})
