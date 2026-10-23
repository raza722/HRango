import { createFileRoute } from '@tanstack/react-router'

import { BranchFormPage } from '@/features/settings'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/settings/control-panel/branches/new')({
  head: () => ({ meta: [{ title: pageTitle('New Branch') }] }),
  component: () => <BranchFormPage />,
})
