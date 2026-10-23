import { createFileRoute } from '@tanstack/react-router'

import { MODULES } from '@/app/modules'
import { ModulePlaceholder } from '@/components/layout'
import { pageTitle } from '@/lib/constants'

const config = MODULES.customForm

export const Route = createFileRoute('/_app/custom-form')({
  head: () => ({ meta: [{ title: pageTitle(config.title) }] }),
  component: () => <ModulePlaceholder {...config} />,
})
