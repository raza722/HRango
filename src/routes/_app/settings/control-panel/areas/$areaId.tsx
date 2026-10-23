import { createFileRoute } from '@tanstack/react-router'

import { AreaFormPage, areaResource } from '@/features/settings'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/settings/control-panel/areas/$areaId')({
  loader: ({ context: { queryClient }, params: { areaId } }) => {
    queryClient.query(areaResource.detailQuery(areaId)).catch(() => undefined)
  },
  head: () => ({ meta: [{ title: pageTitle('Edit Area') }] }),
  component: function EditAreaRoute() {
    const { areaId } = Route.useParams()
    // `key` gives each record a fresh form when moving between edit pages.
    return <AreaFormPage key={areaId} areaId={areaId} />
  },
})
