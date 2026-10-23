import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  LEAVE_PAGE_SEARCH_DEFAULTS,
  leavePageSearchSchema,
  LeaveTypesPage,
} from '@/features/leaves'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/leaves/settings/leave-types')({
  validateSearch: leavePageSearchSchema,
  search: { middlewares: [stripSearchParams(LEAVE_PAGE_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Leaves · Leave Types') }] }),
  component: LeaveTypesPage,
})
