import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { AttendanceLogsPage, LOGS_SEARCH_DEFAULTS, logsSearchSchema } from '@/features/attendance'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/attendance/logs')({
  validateSearch: logsSearchSchema,
  search: { middlewares: [stripSearchParams(LOGS_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Attendance Logs') }] }),
  component: AttendanceLogsPage,
})
