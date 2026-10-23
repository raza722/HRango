import { createRootRouteWithContext } from '@tanstack/react-router'

import { RootLayout } from '@/app/layouts/root-layout'
import type { RouterContext } from '@/app/router'
import { APP_NAME } from '@/lib/constants'

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({ meta: [{ title: APP_NAME }] }),
  component: RootLayout,
})
