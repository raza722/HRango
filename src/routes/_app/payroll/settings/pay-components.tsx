import { createFileRoute } from '@tanstack/react-router'

import { PayrollSettingsPage, settingsViewSchema } from '@/features/payroll'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/payroll/settings/pay-components')({
  validateSearch: settingsViewSchema,
  head: () => ({ meta: [{ title: pageTitle('Payroll Settings · Pay Components') }] }),
  component: () => <PayrollSettingsPage tab="pay-components" />,
})
