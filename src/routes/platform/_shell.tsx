import { createFileRoute, redirect } from '@tanstack/react-router'

import { PlatformLayout } from '@/features/platform'
import { usePlatformStore } from '@/stores/platform-store'

/** Every staff page: the shell, for staff who are signed in. */
export const Route = createFileRoute('/platform/_shell')({
  beforeLoad: () => {
    if (!usePlatformStore.getState().token) {
      throw redirect({ to: '/platform/login', replace: true })
    }
  },
  component: PlatformLayout,
})
