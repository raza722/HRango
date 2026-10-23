import { createFileRoute } from '@tanstack/react-router'

import { SettingsPlaceholder } from '@/features/settings'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/settings/custom-forms')({
  head: () => ({ meta: [{ title: pageTitle('Custom Forms') }] }),
  component: () => <SettingsPlaceholder section="customForms" standalone />,
})
