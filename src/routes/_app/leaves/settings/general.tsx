import { createFileRoute } from '@tanstack/react-router'

import { LeaveGeneralSettingsPage } from '@/features/leaves'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/leaves/settings/general')({
  head: () => ({ meta: [{ title: pageTitle('Leaves · General Settings') }] }),
  component: LeaveGeneralSettingsPage,
})
