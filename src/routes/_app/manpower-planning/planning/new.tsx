import { createFileRoute } from '@tanstack/react-router'

import { PlanCreatePage } from '@/features/manpower-planning'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/manpower-planning/planning/new')({
  head: () => ({ meta: [{ title: pageTitle('Add Planning') }] }),
  component: PlanCreatePage,
})
