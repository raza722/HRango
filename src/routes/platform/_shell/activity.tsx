import { createFileRoute } from '@tanstack/react-router'

import { PlatformActivityPage } from '@/features/platform'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/platform/_shell/activity')({
  head: () => ({ meta: [{ title: pageTitle('Activity Log') }] }),
  component: PlatformActivityPage,
})
