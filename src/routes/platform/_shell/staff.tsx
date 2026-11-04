import { createFileRoute } from '@tanstack/react-router'

import { StaffPage } from '@/features/platform'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/platform/_shell/staff')({
  head: () => ({ meta: [{ title: pageTitle('Staff') }] }),
  component: StaffPage,
})
