import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  AttendanceOvertimePage,
  OVERTIME_SEARCH_DEFAULTS,
  overtimeSearchSchema,
} from '@/features/attendance'
import { pageTitle } from '@/lib/constants'

/** Attendance → Overtime: `?tab=my|applications|bulk-applications|bulk-overtime|policy&page=`. */
export const Route = createFileRoute('/_app/attendance/overtime')({
  validateSearch: overtimeSearchSchema,
  search: { middlewares: [stripSearchParams(OVERTIME_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Overtime') }] }),
  component: AttendanceOvertimePage,
})
