import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  AttendanceInsightsPage,
  OVERVIEW_SEARCH_DEFAULTS,
  overviewSearchSchema,
} from '@/features/attendance'
import { pageTitle } from '@/lib/constants'

/** Attendance sub menu → Attendance Insights: the overview grid beside the sub menu. */
export const Route = createFileRoute('/_app/attendance/insights')({
  validateSearch: overviewSearchSchema,
  search: { middlewares: [stripSearchParams(OVERVIEW_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Attendance Insights') }] }),
  component: InsightsRoute,
})

function InsightsRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <AttendanceInsightsPage
      search={search}
      onSearch={(patch, replace = false) =>
        navigate({ search: (prev) => ({ ...prev, ...patch }), replace })
      }
    />
  )
}
