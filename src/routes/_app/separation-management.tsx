import { createFileRoute } from '@tanstack/react-router'

import { MODULES } from '@/app/modules'
import { SeparationManagementPage } from '@/features/separation-management'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/separation-management')({
  head: () => ({ meta: [{ title: pageTitle(MODULES.separationManagement.title) }] }),
  component: SeparationManagementPage,
})
