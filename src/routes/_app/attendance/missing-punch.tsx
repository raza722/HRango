import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  MISSING_PUNCH_SEARCH_DEFAULTS,
  MissingPunchPage,
  missingPunchSearchSchema,
} from '@/features/attendance'
import { pageTitle } from '@/lib/constants'

/** Attendance sub menu → Missing Punch: the time sheet's days missing a check in or out. */
export const Route = createFileRoute('/_app/attendance/missing-punch')({
  validateSearch: missingPunchSearchSchema,
  search: { middlewares: [stripSearchParams(MISSING_PUNCH_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Missing Punch') }] }),
  component: MissingPunchPage,
})
