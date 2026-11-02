import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import type { LoginInput } from '@/features/auth'
import { usePlatformStore } from '@/stores/platform-store'

import { platformApi } from '../api/platform.api'

/** Signs staff in; the form shows any error inline. */
export function usePlatformLogin() {
  const setSession = usePlatformStore((state) => state.setSession)
  return useCallback(
    async (input: LoginInput) => {
      setSession(await platformApi.login(input))
    },
    [setSession],
  )
}

/** Ends the staff session. A customer signed in on the same browser stays signed in. */
export function usePlatformLogout() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const clearSession = usePlatformStore((state) => state.clearSession)

  return useCallback(async () => {
    try {
      await platformApi.logout()
    } catch {
      // Signing out locally must work even if the API is unreachable.
    }
    clearSession()
    queryClient.removeQueries({ queryKey: ['platform'] })
    await router.navigate({ to: '/platform/login', replace: true })
  }, [clearSession, queryClient, router])
}

export function useStaffList(enabled: boolean) {
  return useQuery({
    queryKey: ['platform', 'staff'],
    queryFn: ({ signal }) => platformApi.staff(signal),
    enabled,
  })
}

export function useStaffAudit(enabled: boolean) {
  return useQuery({
    queryKey: ['platform', 'audit'],
    queryFn: ({ signal }) => platformApi.audit(signal),
    enabled,
  })
}
