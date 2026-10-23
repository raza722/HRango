import { createFileRoute } from '@tanstack/react-router'

import { PayrollSettingsPage, settingsViewSchema } from '@/features/payroll'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/payroll/settings/account-type')({
  validateSearch: settingsViewSchema,
  head: () => ({ meta: [{ title: pageTitle('Payroll Settings · Account Type') }] }),
  component: () => <PayrollSettingsPage tab="account-type" />,
})
