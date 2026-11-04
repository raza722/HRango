import { useCallback, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import type { LoginInput } from '@/features/auth'
import { usePlatformStore } from '@/stores/platform-store'

import { type ListParams, type Plan, platformApi, type StaffOption } from '../api/platform.api'

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

export function usePlatformDashboard() {
  return useQuery({
    queryKey: ['platform', 'dashboard'],
    queryFn: ({ signal }) => platformApi.dashboard(signal),
  })
}

export function usePlatformList<T>(path: string, params: ListParams, enabled = true) {
  return useQuery({
    queryKey: ['platform', path, params],
    queryFn: ({ signal }) => platformApi.list<T>(path, params, signal),
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** A single record or an unpaged list. */
export function usePlatformGet<T>(path: string, enabled = true) {
  return useQuery({
    queryKey: ['platform', path],
    queryFn: ({ signal }) => platformApi.get<T>(path, signal),
    enabled,
  })
}

/** Every organisation, for pickers. */
export function useOrganisationOptions(enabled = true) {
  const query = usePlatformList<{ id: string; name: string }>(
    'organisations',
    { pageSize: 100 },
    enabled,
  )
  return (query.data?.data ?? []).map((row) => ({ value: row.id, label: row.name }))
}

export function usePlanOptions() {
  const query = usePlatformGet<Plan[]>('plans')
  return (query.data ?? [])
    .filter((plan) => plan.isActive)
    .map((plan) => ({ value: plan.id, label: plan.name }))
}

export function useStaffOptions() {
  const query = usePlatformGet<StaffOption[]>('staff/lookup')
  return (query.data ?? []).map((row) => ({ value: row.id, label: row.displayName }))
}

/** A change to platform data: refreshes every staff screen, errors stay with the dialog. */
export function usePlatformMutation<TInput, TResult = unknown>(
  mutationFn: (input: TInput) => Promise<TResult>,
  successMessage: string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    meta: { successMessage, suppressErrorToast: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform'] }),
  })
}

/** Page, page size, search and one filter of a list screen. */
export function useListState() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [q, setSearch] = useState('')
  const [filter, setFilterValue] = useState<string | undefined>(undefined)
  return {
    page,
    pageSize,
    q,
    filter,
    setPage,
    setPageSize: (value: number) => {
      setPageSize(value)
      setPage(1)
    },
    setSearch: (value: string) => {
      setSearch(value)
      setPage(1)
    },
    setFilter: (value: string | undefined) => {
      setFilterValue(value)
      setPage(1)
    },
  }
}
