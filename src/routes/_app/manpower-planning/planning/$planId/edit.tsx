import { createFileRoute } from '@tanstack/react-router'

import { PlanEditPage } from '@/features/manpower-planning'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/manpower-planning/planning/$planId/edit')({
  head: () => ({ meta: [{ title: pageTitle('Edit Planning') }] }),
  component: PlanEditPage,
})
