import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { LeaveEncashmentPage, PAGE_SEARCH_DEFAULTS, pageSearchSchema } from '@/features/payroll'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/payroll/leave-encashment')({
  validateSearch: pageSearchSchema,
  search: { middlewares: [stripSearchParams(PAGE_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Leave Encashment') }] }),
  component: LeaveEncashmentPage,
})
