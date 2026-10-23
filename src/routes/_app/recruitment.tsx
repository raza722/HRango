import { createFileRoute } from '@tanstack/react-router'

import { MODULES } from '@/app/modules'
import { ModulePlaceholder } from '@/components/layout'
import { pageTitle } from '@/lib/constants'

const config = MODULES.recruitment

export const Route = createFileRoute('/_app/recruitment')({
  head: () => ({ meta: [{ title: pageTitle(config.title) }] }),
  component: () => <ModulePlaceholder {...config} />,
})
