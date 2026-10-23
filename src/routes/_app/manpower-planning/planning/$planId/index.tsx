import { createFileRoute } from '@tanstack/react-router'

import { PlanViewPage } from '@/features/manpower-planning'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/manpower-planning/planning/$planId/')({
  head: () => ({ meta: [{ title: pageTitle('Plan Details') }] }),
  component: PlanViewPage,
})
