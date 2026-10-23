import { lazy, Suspense } from 'react'
import { HeadContent, Outlet } from '@tanstack/react-router'

import { env } from '@/lib/env'

const RouterDevtools =
  env.DEV && env.VITE_ENABLE_DEVTOOLS
    ? lazy(() =>
        import('@tanstack/react-router-devtools').then((module) => ({
          default: module.TanStackRouterDevtools,
        })),
      )
    : null

/** Top of the route tree: document head tags, the matched route, devtools. */
export function RootLayout() {
  return (
    <>
      <HeadContent />
      <Outlet />
      {RouterDevtools && (
        <Suspense fallback={null}>
          <RouterDevtools position="bottom-right" />
        </Suspense>
      )}
    </>
  )
}
