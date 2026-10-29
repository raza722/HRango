import { createFileRoute } from '@tanstack/react-router'

import { MODULES } from '@/app/modules'
import { ConfigurationPage } from '@/features/configuration'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/configuration')({
  head: () => ({ meta: [{ title: pageTitle(MODULES.configuration.title) }] }),
  component: ConfigurationPage,
})
