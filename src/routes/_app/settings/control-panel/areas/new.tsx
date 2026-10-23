import { createFileRoute } from '@tanstack/react-router'

import { AreaFormPage } from '@/features/settings'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/settings/control-panel/areas/new')({
  head: () => ({ meta: [{ title: pageTitle('New Area') }] }),
  component: () => <AreaFormPage />,
})
