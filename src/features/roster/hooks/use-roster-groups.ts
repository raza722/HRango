import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { withoutRecord } from '@/lib/paginated-cache'
import type { Paginated } from '@/types/api'

import {
  rosterApi,
  rosterGroupQueryOptions,
  rosterGroupsQueryOptions,
  rosterKeys,
  type RosterListParams,
  timeSlotOptionsQueryOptions,
} from '../api/roster.api'
import type { RosterGroupInput, RosterGroupRow } from '../types/roster.types'

/** One page of roster groups; the previous page stays visible while the next loads. */
export function useRosterGroups(params: RosterListParams) {
  return useQuery(rosterGroupsQueryOptions(params))
}

/** A single roster group; pass `undefined` to stay idle. */
export function useRosterGroup(id: string | undefined) {
  return useQuery({ ...rosterGroupQueryOptions(id ?? ''), enabled: id !== undefined })
}

/** Time slots for the week's pickers (`/scheduling/options/time-slots`). */
export function useTimeSlotOptions() {
  return useQuery(timeSlotOptionsQueryOptions())
}

/** Creates (no `id`) or updates a group, then refreshes the lists. */
export function useSaveRosterGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string | undefined; input: RosterGroupInput }) =>
      id ? rosterApi.update(id, input) : rosterApi.create(input),
    onSuccess: async (group, { id }) => {
      queryClient.setQueryData(rosterKeys.detail(group.id), group)
      toast.success(`Roster group “${group.title}” ${id ? 'updated' : 'created'}`)
      await queryClient.invalidateQueries({ queryKey: rosterKeys.lists() })
    },
  })
}

type ListSnapshot = [readonly unknown[], Paginated<RosterGroupRow> | undefined][]

/** Restores every cached list page taken before an optimistic change. */
function useRollback() {
  const queryClient = useQueryClient()
  return (snapshot: ListSnapshot | undefined) => {
    snapshot?.forEach(([queryKey, page]) => {
      queryClient.setQueryData(queryKey, page)
    })
  }
}

/** The list Status switch: flips at once, flips back if the API refuses. */
export function useSetRosterGroupStatus() {
  const queryClient = useQueryClient()
  const rollback = useRollback()
  return useMutation({
    mutationFn: ({ group, isActive }: { group: RosterGroupRow; isActive: boolean }) =>
      rosterApi.setStatus(group.id, isActive),
    onMutate: async ({ group, isActive }) => {
      await queryClient.cancelQueries({ queryKey: rosterKeys.lists() })
      const snapshot: ListSnapshot = queryClient.getQueriesData<Paginated<RosterGroupRow>>({
        queryKey: rosterKeys.lists(),
      })
      queryClient.setQueriesData<Paginated<RosterGroupRow>>(
        { queryKey: rosterKeys.lists() },
        (page) =>
          page && {
            ...page,
            data: page.data.map((row) => (row.id === group.id ? { ...row, isActive } : row)),
          },
      )
      return { snapshot }
    },
    onError: (_error, _variables, onMutateResult) => {
      rollback(onMutateResult?.snapshot)
    },
    onSuccess: (group) => {
      queryClient.setQueryData(rosterKeys.detail(group.id), group)
      toast.success(`“${group.title}” is now ${group.isActive ? 'active' : 'inactive'}`)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: rosterKeys.lists() }),
  })
}

/** Deletes a group optimistically; it comes back if employees are still enrolled (409). */
export function useDeleteRosterGroup() {
  const queryClient = useQueryClient()
  const rollback = useRollback()
  return useMutation({
    mutationFn: (group: RosterGroupRow) => rosterApi.remove(group.id, group.rowVersion),
    onMutate: async (group) => {
      await queryClient.cancelQueries({ queryKey: rosterKeys.lists() })
      const snapshot: ListSnapshot = queryClient.getQueriesData<Paginated<RosterGroupRow>>({
        queryKey: rosterKeys.lists(),
      })
      queryClient.setQueriesData<Paginated<RosterGroupRow>>(
        { queryKey: rosterKeys.lists() },
        (page) => (page ? withoutRecord(page, group.id) : page),
      )
      return { snapshot }
    },
    onError: (_error, _group, onMutateResult) => {
      rollback(onMutateResult?.snapshot)
    },
    onSuccess: (_data, group) => {
      queryClient.removeQueries({ queryKey: rosterKeys.detail(group.id) })
      toast.success(`Roster group “${group.title}” deleted`)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: rosterKeys.lists() }),
  })
}
