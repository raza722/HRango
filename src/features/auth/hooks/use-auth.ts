import { useCallback, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'

import { isMockApi } from '@/lib/env'
import { useAuthStore } from '@/stores/auth-store'

import { authApi } from '../api/auth.api'
import type { LoginInput } from '../schemas/login.schema'

/**
 * Signs in against the (mock) API and stores the session.
 * Errors are not toasted globally; the login form shows them inline.
 */
export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession)
  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    meta: { suppressErrorToast: true },
    onSuccess: (session) => {
      setSession(session)
      toast.success(`Welcome back, ${session.user.name.split(' ')[0] ?? session.user.name}`)
    },
  })
}

/**
 * Returns a function that ends the session: tells the API (best effort),
 * clears the store and every cached query, then returns to /login.
 */
export function useLogout() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const clearSession = useAuthStore((state) => state.clearSession)

  return useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Signing out locally must work even if the API is unreachable.
    }
    clearSession()
    queryClient.clear()
    await router.navigate({ to: '/login', replace: true })
  }, [clearSession, queryClient, router])
}

/**
 * Keeps the stored user (name, role, permissions) in step with the API: reads `GET /auth/me` when
 * the signed-in shell mounts and every few minutes, so a role change shows without signing out.
 * Not against the mock API: its /auth/me is always the demo user, which would replace a test's user.
 */
export function useSessionRefresh() {
  const updateUser = useAuthStore((state) => state.updateUser)
  const signedIn = useAuthStore((state) => state.token !== null)
  const { data } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: ({ signal }) => authApi.me(signal),
    enabled: signedIn && !isMockApi,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  })
  useEffect(() => {
    if (data) updateUser(data)
  }, [data, updateUser])
}
