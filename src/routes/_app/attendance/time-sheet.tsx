import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  TIME_SHEET_SEARCH_DEFAULTS,
  TimeSheetPage,
  timeSheetSearchSchema,
} from '@/features/attendance'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/attendance/time-sheet')({
  validateSearch: timeSheetSearchSchema,
  search: { middlewares: [stripSearchParams(TIME_SHEET_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Time Sheet') }] }),
  component: TimeSheetPage,
})
