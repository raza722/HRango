import { createFileRoute } from '@tanstack/react-router'

import { SettingsPlaceholder } from '@/features/settings'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/settings/control-panel/help')({
  head: () => ({ meta: [{ title: pageTitle('Help & Support') }] }),
  component: () => <SettingsPlaceholder section="help" />,
})
