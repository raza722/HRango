import { createFileRoute } from '@tanstack/react-router'

import { OrganisationDetailPage } from '@/features/platform'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/platform/_shell/organisations/$id')({
  head: () => ({ meta: [{ title: pageTitle('Organisation') }] }),
  component: OrganisationDetailPage,
})
