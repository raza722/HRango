import { createFileRoute } from '@tanstack/react-router'

import { GeneralSettingsPage, generalSettingsQueryOptions } from '@/features/settings'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/settings/control-panel/general')({
  loader: ({ context: { queryClient } }) => {
    queryClient.query(generalSettingsQueryOptions()).catch(() => undefined)
  },
  head: () => ({ meta: [{ title: pageTitle('General Settings') }] }),
  component: GeneralSettingsPage,
})
