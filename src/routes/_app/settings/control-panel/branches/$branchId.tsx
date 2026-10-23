import { createFileRoute } from '@tanstack/react-router'

import { BranchFormPage, branchResource } from '@/features/settings'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/settings/control-panel/branches/$branchId')({
  loader: ({ context: { queryClient }, params: { branchId } }) => {
    queryClient.query(branchResource.detailQuery(branchId)).catch(() => undefined)
  },
  head: () => ({ meta: [{ title: pageTitle('Edit Branch') }] }),
  component: function EditBranchRoute() {
    const { branchId } = Route.useParams()
    // `key` gives each record a fresh form when moving between edit pages.
    return <BranchFormPage key={branchId} branchId={branchId} />
  },
})
