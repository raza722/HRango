import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import { standardKeys } from '../../standard.api'
import type { LeaveBalance, LeaveLookups, LeaveTypeOption } from './leave.types'

export const SHORT_TYPES: LeaveLookups['shortTypes'] = [
  { value: 'half_day', label: 'Half Day', fraction: 0.5 },
  { value: 'quarter_day', label: 'Quarter Day', fraction: 0.25 },
]

export const shortTypeLabel = (value: string | null) =>
  SHORT_TYPES.find((item) => item.value === value)?.label ?? null

/** A person's balances; with no employee, the caller's own (the API's scope decides). */
export async function fetchLeaveBalances(
  employeeId: string | null,
  signal?: AbortSignal,
): Promise<LeaveBalance[]> {
  const { data } = await apiClient.get<Paginated<LeaveBalance & { employeeId: string }>>(
    '/leaves/balances',
    { params: { ...(employeeId ? { employeeId } : {}), pageSize: 100 }, signal },
  )
  // Without an employee the API lists everyone the caller may see: keep it only when it is one person.
  const people = new Set(data.data.map((row) => row.employeeId))
  return !employeeId && people.size > 1 ? [] : data.data
}

/**
 * The leave types `employeeId` (default: the signed-in person) may apply for, with their
 * balance and form rules (`GET /requests/options/leave-types`, `requests.leave.create`).
 */
export async function fetchLeaveTypeOptions(
  employeeId: string | null,
  signal?: AbortSignal,
): Promise<LeaveTypeOption[]> {
  const { data } = await apiClient.get<ApiItem<LeaveTypeOption[]>>(
    '/requests/options/leave-types',
    { params: employeeId ? { employeeId } : {}, signal },
  )
  return data.data
}

/** The Leave form's own look-ups. */
export function loadLeaveLookups(): Promise<LeaveLookups> {
  return Promise.resolve({ shortTypes: SHORT_TYPES })
}

/** The leave types one person may apply for (`mine`: the signed-in person, without an id here). */
export function useLeaveTypeOptions(employeeId: string | null | undefined, mine = false) {
  return useQuery({
    queryKey: [...standardKeys.kind('leave'), 'type-options', employeeId ?? (mine ? 'me' : '')],
    queryFn: ({ signal }) => fetchLeaveTypeOptions(employeeId ?? null, signal),
    enabled: Boolean(employeeId) || mine,
  })
}

/** One person's balances (`mine`: the signed-in person's, when they have no id here). */
export function useLeaveBalances(employeeId: string | null | undefined, mine = false) {
  return useQuery({
    queryKey: [...standardKeys.kind('leave'), 'balances', employeeId ?? (mine ? 'me' : '')],
    queryFn: ({ signal }) => fetchLeaveBalances(employeeId ?? null, signal),
    enabled: Boolean(employeeId) || mine,
  })
}
