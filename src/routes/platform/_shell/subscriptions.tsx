import { createFileRoute } from '@tanstack/react-router'

import { SubscriptionsPage } from '@/features/platform'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/platform/_shell/subscriptions')({
  head: () => ({ meta: [{ title: pageTitle('Subscriptions') }] }),
  component: SubscriptionsPage,
})
