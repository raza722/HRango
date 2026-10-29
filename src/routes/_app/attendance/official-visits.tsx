import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { AttendanceOfficialVisitsPage } from '@/features/attendance'
import { STANDARD_SEARCH_DEFAULTS, standardSearchSchema } from '@/features/requests'
import { pageTitle } from '@/lib/constants'

/** Attendance sub menu → Official Visits: the request type's pages beside the sub menu. */
export const Route = createFileRoute('/_app/attendance/official-visits')({
  validateSearch: standardSearchSchema,
  search: { middlewares: [stripSearchParams(STANDARD_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Official Visits') }] }),
  component: OfficialVisitsRoute,
})

function OfficialVisitsRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <AttendanceOfficialVisitsPage
      search={search}
      onSearch={(patch) => {
        void navigate({ search: (prev) => ({ ...prev, ...patch }) })
      }}
    />
  )
}
