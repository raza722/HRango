import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { LEAVE_LIST_SEARCH_DEFAULTS, leaveListSearchSchema, MyLeavesPage } from '@/features/leaves'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/leaves/my-leaves')({
  validateSearch: leaveListSearchSchema,
  search: { middlewares: [stripSearchParams(LEAVE_LIST_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('My Leaves') }] }),
  component: MyLeavesPage,
})
