import { createFileRoute } from '@tanstack/react-router'

import { LocationFormPage } from '@/features/settings'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/settings/control-panel/locations/new')({
  head: () => ({ meta: [{ title: pageTitle('New Location') }] }),
  component: () => <LocationFormPage />,
})
