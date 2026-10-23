import { createFileRoute } from '@tanstack/react-router'

import { SettingsPlaceholder } from '@/features/settings'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/settings/control-panel/users')({
  head: () => ({ meta: [{ title: pageTitle('Users') }] }),
  component: () => <SettingsPlaceholder section="users" />,
})
