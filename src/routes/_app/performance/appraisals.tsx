import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  APPRAISALS_SEARCH_DEFAULTS,
  AppraisalsPage,
  appraisalsSearchSchema,
} from '@/features/performance'
import { pageTitle } from '@/lib/constants'

/** Performance → Appraisals: the list, one appraisal in full, and Finalise. */
export const Route = createFileRoute('/_app/performance/appraisals')({
  validateSearch: appraisalsSearchSchema,
  search: { middlewares: [stripSearchParams(APPRAISALS_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Appraisals') }] }),
  component: AppraisalsRoute,
})

function AppraisalsRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <AppraisalsPage
      search={search}
      onSearch={(patch) => {
        void navigate({ search: (prev) => ({ ...prev, ...patch }) })
      }}
    />
  )
}
