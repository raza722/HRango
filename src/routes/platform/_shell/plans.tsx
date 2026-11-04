import { createFileRoute } from '@tanstack/react-router'

import { PlansPage } from '@/features/platform'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/platform/_shell/plans')({
  head: () => ({ meta: [{ title: pageTitle('Plans') }] }),
  component: PlansPage,
})
