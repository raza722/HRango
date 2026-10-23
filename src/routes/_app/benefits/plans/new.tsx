import { createFileRoute } from '@tanstack/react-router'

import { AddPlanPage, addPlanSearchSchema } from '@/features/benefits'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/benefits/plans/new')({
  validateSearch: addPlanSearchSchema,
  head: () => ({ meta: [{ title: pageTitle('Add Plan') }] }),
  component: AddPlanPage,
})
