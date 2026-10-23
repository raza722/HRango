import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  AttendanceOverviewPage,
  OVERVIEW_SEARCH_DEFAULTS,
  overviewSearchSchema,
} from '@/features/attendance'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/attendance/overview')({
  validateSearch: overviewSearchSchema,
  search: { middlewares: [stripSearchParams(OVERVIEW_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Attendance Overview') }] }),
  component: AttendanceOverviewPage,
})
