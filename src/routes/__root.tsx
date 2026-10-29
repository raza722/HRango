import { createRootRouteWithContext } from '@tanstack/react-router'

import { RootLayout } from '@/app/layouts/root-layout'
import type { RouterContext } from '@/app/router'
import { APP_NAME, pageTitle } from '@/lib/constants'

export const Route = createRootRouteWithContext<RouterContext>()({
  // Every page is a child of the root: when the root is all that matched, the URL is unknown
  // and the 404 page shows. Pages set their own titles over this one.
  head: ({ matches }) => ({
    meta: [{ title: matches.length <= 1 ? pageTitle('Page not found') : APP_NAME }],
  }),
  component: RootLayout,
})
