import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  DASHBOARD_SEARCH_DEFAULTS,
  dashboardSearchSchema,
  RecruitmentDashboardPage,
} from '@/features/recruitment'
import { pageTitle } from '@/lib/constants'

/** Recruitment Dashboard: tiles, monthly statistics, pipeline, interviews and activity. */
export const Route = createFileRoute('/_app/recruitment/dashboard')({
  validateSearch: dashboardSearchSchema,
  search: { middlewares: [stripSearchParams(DASHBOARD_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Recruitment Dashboard') }] }),
  component: RecruitmentDashboardPage,
})
