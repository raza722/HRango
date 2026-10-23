import { createFileRoute } from '@tanstack/react-router'

import { PayrollSettingsPage, settingsViewSchema } from '@/features/payroll'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/payroll/settings/disbursement-banks')({
  validateSearch: settingsViewSchema,
  head: () => ({ meta: [{ title: pageTitle('Payroll Settings · Disbursement Banks') }] }),
  component: () => <PayrollSettingsPage tab="disbursement-banks" />,
})
