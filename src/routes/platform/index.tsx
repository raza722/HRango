import { createFileRoute, redirect } from '@tanstack/react-router'

import { PlatformHomePage } from '@/features/platform'
import { pageTitle } from '@/lib/constants'
import { usePlatformStore } from '@/stores/platform-store'

export const Route = createFileRoute('/platform/')({
  beforeLoad: () => {
    if (!usePlatformStore.getState().token) {
      throw redirect({ to: '/platform/login', replace: true })
    }
  },
  head: () => ({ meta: [{ title: pageTitle('Staff') }] }),
  component: PlatformHomePage,
})
