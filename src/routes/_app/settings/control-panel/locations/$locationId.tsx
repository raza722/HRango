import { createFileRoute } from '@tanstack/react-router'

import { LocationFormPage, locationResource } from '@/features/settings'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/settings/control-panel/locations/$locationId')({
  loader: ({ context: { queryClient }, params: { locationId } }) => {
    queryClient.query(locationResource.detailQuery(locationId)).catch(() => undefined)
  },
  head: () => ({ meta: [{ title: pageTitle('Edit Location') }] }),
  component: function EditLocationRoute() {
    const { locationId } = Route.useParams()
    // `key` gives each record a fresh form when moving between edit pages.
    return <LocationFormPage key={locationId} locationId={locationId} />
  },
})
