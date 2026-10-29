import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { AttendanceSchedulingPage } from '@/features/attendance'
import { SCHEDULING_SEARCH_DEFAULTS, schedulingSearchSchema } from '@/features/scheduling'
import { pageTitle } from '@/lib/constants'

/** Attendance sub menu → Scheduling: the scheduling board beside the sub menu. */
export const Route = createFileRoute('/_app/attendance/scheduling')({
  validateSearch: schedulingSearchSchema,
  search: { middlewares: [stripSearchParams(SCHEDULING_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Scheduling') }] }),
  component: SchedulingRoute,
})

function SchedulingRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <AttendanceSchedulingPage
      search={search}
      onSearch={(patch, replace = false) =>
        navigate({ search: (prev) => ({ ...prev, ...patch }), replace })
      }
    />
  )
}
