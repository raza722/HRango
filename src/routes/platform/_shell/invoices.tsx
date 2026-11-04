import { createFileRoute } from '@tanstack/react-router'

import { PlatformInvoicesPage } from '@/features/platform'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/platform/_shell/invoices')({
  head: () => ({ meta: [{ title: pageTitle('Invoices') }] }),
  component: PlatformInvoicesPage,
})
