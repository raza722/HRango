import type { ReactElement, ReactNode } from 'react'
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, type RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { App } from '@/app/app'
import { createAppRouter } from '@/app/router'
import { connectApiClientToSession } from '@/app/session'
import { configureApiClient } from '@/lib/axios'
import { createQueryClient } from '@/lib/query-client'
import { DEMO_USER } from '@/mocks/auth/handlers'
import { MOCK_TOKEN_PREFIX } from '@/mocks/utils'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Renders at a given window width: `useMediaQuery` (and so the sidebar, tables
 * and pager) follow it. Call before rendering; it resets after each test.
 */
export function setViewportWidth(width: number): void {
  window.innerWidth = width
}

/** App defaults, minus retries and with a cache that never expires mid-test. */
export function createTestQueryClient(): QueryClient {
  const queryClient = createQueryClient()
  queryClient.setDefaultOptions({
    queries: { retry: false, gcTime: Number.POSITIVE_INFINITY, refetchInterval: false },
    mutations: { retry: false },
  })
  return queryClient
}

/** Stores a valid mock session and points axios at it (no router needed). */
export function signIn(): void {
  useAuthStore.getState().setSession({ token: `${MOCK_TOKEN_PREFIX}test`, user: DEMO_USER })
  configureApiClient({
    getAccessToken: () => useAuthStore.getState().token,
    onUnauthorized: () => undefined,
  })
}

/** Wrapper for `renderHook` / `render` that needs only TanStack Query. */
export function createQueryWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

export function renderWithQueryClient(
  ui: ReactElement,
  {
    queryClient = createTestQueryClient(),
    ...options
  }: RenderOptions & { queryClient?: QueryClient } = {},
) {
  return {
    queryClient,
    user: userEvent.setup(),
    ...render(ui, { wrapper: createQueryWrapper(queryClient), ...options }),
  }
}

/**
 * Renders the whole app (providers, router, auth gate) at `path` with memory
 * history, talking to the MSW node server.
 */
export function renderApp(path: string, { signedIn = true }: { signedIn?: boolean } = {}) {
  if (signedIn) {
    useAuthStore.getState().setSession({ token: `${MOCK_TOKEN_PREFIX}test`, user: DEMO_USER })
  }
  const queryClient = createTestQueryClient()
  const router = createAppRouter({
    queryClient,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  connectApiClientToSession(router, queryClient)

  return {
    router,
    queryClient,
    user: userEvent.setup(),
    ...render(<App router={router} queryClient={queryClient} />),
  }
}
