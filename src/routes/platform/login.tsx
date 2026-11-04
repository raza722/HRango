import { createFileRoute, redirect } from '@tanstack/react-router'

import { PlatformLoginPage } from '@/features/platform'
import { pageTitle } from '@/lib/constants'
import { usePlatformStore } from '@/stores/platform-store'

/** Public route for hRango's own staff. Signed-in staff are sent straight on. */
export const Route = createFileRoute('/platform/login')({
  beforeLoad: () => {
    if (usePlatformStore.getState().token) {
      throw redirect({ to: '/platform', replace: true })
    }
  },
  head: () => ({ meta: [{ title: pageTitle('Staff sign in') }] }),
  component: PlatformLoginPage,
})
