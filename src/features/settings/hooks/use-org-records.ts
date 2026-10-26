import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { withoutRecord } from '@/lib/paginated-cache'
import type { Paginated } from '@/types/api'

import { type OrgListParams, type OrgResource, SETTINGS_QUERY_ROOT } from '../api/org-resource'
import { capitalize } from '../utils/text'

interface AnyRecord {
  id: string
  name: string
  rowVersion: string
}

/**
 * Every Control Panel list and picker, of every type. Renaming a location changes the
 * "Location" column of branches and areas, so saves refresh all of them.
 */
function invalidateOrgLists(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: ({ queryKey }) =>
      queryKey[0] === SETTINGS_QUERY_ROOT &&
      (queryKey[2] === 'list' || (queryKey[1] === 'lookups' && queryKey[2] === 'org')),
  })
}

/** One page of a Control Panel list; the previous page stays visible while the next loads. */
export function useOrgList<TRecord extends AnyRecord, TInput, TRow extends AnyRecord>(
  resource: OrgResource<TRecord, TInput, TRow>,
  params: OrgListParams,
  options: { enabled?: boolean } = {},
) {
  return useQuery({ ...resource.listQuery(params), enabled: options.enabled ?? true })
}

/** A single record; pass `undefined` to stay idle (creating, not editing). */
export function useOrgRecord<TRecord extends AnyRecord, TInput, TRow extends AnyRecord>(
  resource: OrgResource<TRecord, TInput, TRow>,
  id: string | undefined,
) {
  return useQuery({ ...resource.detailQuery(id ?? ''), enabled: id !== undefined })
}

/**
 * Creates (no `id`) or updates a record, then refreshes the lists. Updating sends the
 * `rowVersion` last read; the API refuses a stale one (409, someone else saved first).
 */
export function useSaveOrgRecord<TRecord extends AnyRecord, TInput, TRow extends AnyRecord>(
  resource: OrgResource<TRecord, TInput, TRow>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
      rowVersion,
    }: {
      id?: string | undefined
      input: TInput
      rowVersion?: string | undefined
    }) => (id ? resource.api.update(id, input, rowVersion ?? '') : resource.api.create(input)),
    onSuccess: async (record, { id }) => {
      queryClient.setQueryData(resource.detailQuery(record.id).queryKey, record)
      toast.success(
        `${capitalize(resource.singular)} “${record.name}” ${id ? 'updated' : 'created'}`,
      )
      await invalidateOrgLists(queryClient)
    },
  })
}

/**
 * Deletes a record optimistically: it leaves the list at once and comes back
 * if the API refuses (for example a location that still has branches).
 */
export function useDeleteOrgRecord<TRecord extends AnyRecord, TInput, TRow extends AnyRecord>(
  resource: OrgResource<TRecord, TInput, TRow>,
) {
  const queryClient = useQueryClient()
  const lists = resource.keys.lists()
  return useMutation({
    mutationFn: (row: TRow) => resource.api.remove(row.id, row.rowVersion),
    onMutate: async (row) => {
      await queryClient.cancelQueries({ queryKey: lists })
      const snapshot = queryClient.getQueriesData<Paginated<TRow>>({ queryKey: lists })
      queryClient.setQueriesData<Paginated<TRow>>({ queryKey: lists }, (page) =>
        page ? withoutRecord(page, row.id) : page,
      )
      return { snapshot }
    },
    onError: (_error, _row, onMutateResult) => {
      onMutateResult?.snapshot.forEach(([queryKey, page]) => {
        queryClient.setQueryData(queryKey, page)
      })
    },
    onSuccess: (_data, row) => {
      queryClient.removeQueries({ queryKey: resource.keys.detail(row.id) })
      toast.success(`${capitalize(resource.singular)} “${row.name}” deleted`)
    },
    onSettled: () => invalidateOrgLists(queryClient),
  })
}
