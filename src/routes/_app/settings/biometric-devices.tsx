import { createFileRoute } from '@tanstack/react-router'

import { SettingsPlaceholder } from '@/features/settings'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/settings/biometric-devices')({
  head: () => ({ meta: [{ title: pageTitle('Biometric Devices') }] }),
  component: () => <SettingsPlaceholder section="biometricDevices" standalone />,
})
