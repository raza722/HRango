import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  LEAVE_LIST_SEARCH_DEFAULTS,
  LeaveApplicationsPage,
  leaveListSearchSchema,
} from '@/features/leaves'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/leaves/applications')({
  validateSearch: leaveListSearchSchema,
  search: { middlewares: [stripSearchParams(LEAVE_LIST_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Leave Applications') }] }),
  component: LeaveApplicationsPage,
})
