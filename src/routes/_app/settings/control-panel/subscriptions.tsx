import { createFileRoute } from '@tanstack/react-router'

import { SettingsPlaceholder } from '@/features/settings'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/settings/control-panel/subscriptions')({
  head: () => ({ meta: [{ title: pageTitle('Subscriptions') }] }),
  component: () => <SettingsPlaceholder section="subscriptions" />,
})
