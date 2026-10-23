import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  LEAVE_PAGE_SEARCH_DEFAULTS,
  leavePageSearchSchema,
  LeavePoliciesPage,
} from '@/features/leaves'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/leaves/settings/policies')({
  validateSearch: leavePageSearchSchema,
  search: { middlewares: [stripSearchParams(LEAVE_PAGE_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Leaves · Leave Policies') }] }),
  component: LeavePoliciesPage,
})
