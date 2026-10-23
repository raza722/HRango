import { createFileRoute } from '@tanstack/react-router'

import { SettingsPlaceholder } from '@/features/settings'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/settings/user-group-permissions')({
  head: () => ({ meta: [{ title: pageTitle('User Group Permissions') }] }),
  component: () => <SettingsPlaceholder section="userGroupPermissions" standalone />,
})
