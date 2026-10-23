import type { QueryClient } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'

import { AppProviders } from './providers'
import type { AppRouter } from './router'

interface AppProps {
  router: AppRouter
  queryClient: QueryClient
}

/** Root component: global providers around the router. */
export function App({ router, queryClient }: AppProps) {
  return (
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
