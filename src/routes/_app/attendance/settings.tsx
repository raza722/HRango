import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  AttendanceSettingsPage,
  SETTINGS_SEARCH_DEFAULTS,
  settingsSearchSchema,
} from '@/features/attendance'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/attendance/settings')({
  validateSearch: settingsSearchSchema,
  search: { middlewares: [stripSearchParams(SETTINGS_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Attendance Settings') }] }),
  component: AttendanceSettingsPage,
})
