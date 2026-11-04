import { createFileRoute } from '@tanstack/react-router'

import { SupportPage } from '@/features/platform'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/platform/_shell/support')({
  head: () => ({ meta: [{ title: pageTitle('Support') }] }),
  component: SupportPage,
})
