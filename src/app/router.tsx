import type { QueryClient } from '@tanstack/react-query'
import { createRouter, type RouterHistory } from '@tanstack/react-router'

import { PageSpinner } from '@/components/feedback/spinner'
import { routeTree } from '@/routeTree.gen'
import { selectIsAuthenticated, useAuthStore } from '@/stores/auth-store'

import { NotFoundPage, RouteErrorPage } from './pages'

/** What every route's `beforeLoad` / `loader` receives as `context`. */
export interface RouterContext {
  queryClient: QueryClient
  auth: {
    /** Read at navigation time, so guards always see the current session. */
    isAuthenticated: () => boolean
  }
}

export const authContext: RouterContext['auth'] = {
  isAuthenticated: () => selectIsAuthenticated(useAuthStore.getState()),
}

interface CreateAppRouterOptions {
  queryClient: QueryClient
  /** Memory history in tests; browser history by default. */
  history?: RouterHistory
}

export function createAppRouter({ queryClient, history }: CreateAppRouterOptions) {
  return createRouter({
    routeTree,
    history,
    context: { queryClient, auth: authContext },
    // Preload on hover/focus; let TanStack Query decide freshness.
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultPendingComponent: () => <PageSpinner />,
    defaultErrorComponent: RouteErrorPage,
    defaultNotFoundComponent: NotFoundPage,
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter
  }
}
