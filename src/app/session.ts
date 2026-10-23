import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { configureApiClient } from '@/lib/axios'
import { useAuthStore } from '@/stores/auth-store'

import type { AppRouter } from './router'

/**
 * Connects the axios client to the session: attaches the bearer token and,
 * on a 401, signs out and sends the user to /login with a return path.
 */
export function connectApiClientToSession(router: AppRouter, queryClient: QueryClient): void {
  configureApiClient({
    getAccessToken: () => useAuthStore.getState().token,
    onUnauthorized: () => {
      // Several requests can fail at once; only react to the first.
      if (!useAuthStore.getState().token) return
      useAuthStore.getState().clearSession()
      queryClient.clear()
      toast.error('Your session has expired. Please sign in again.')
      void router.navigate({
        to: '/login',
        search: { redirect: router.state.location.href },
        replace: true,
      })
    },
  })
}
