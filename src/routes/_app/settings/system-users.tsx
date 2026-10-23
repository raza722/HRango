import { createFileRoute } from '@tanstack/react-router'

import { SettingsPlaceholder } from '@/features/settings'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/settings/system-users')({
  head: () => ({ meta: [{ title: pageTitle('System User') }] }),
  component: () => <SettingsPlaceholder section="systemUsers" standalone />,
})
