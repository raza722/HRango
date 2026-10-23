import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  type AllocationFilters,
  type AssetFilters,
  assetKeys,
  assetListQueryOptions,
  assetLookupsQueryOptions,
  assetsApi,
  type AssetTypeFilters,
  type ClearanceFilters,
  type ImportResult,
  type PageQuery,
} from '../api/assets.api'
import type {
  AllocationInput,
  AssetImportRow,
  AssetInput,
  AssetTypeInput,
  ClearanceInput,
} from '../types/assets.types'

// --- queries ------------------------------------------------------------------------------------

export const useAssetLookups = () => useQuery(assetLookupsQueryOptions())

export const useAssetTypes = (params: PageQuery<AssetTypeFilters>) =>
  useQuery(assetListQueryOptions('types', params, assetsApi.assetTypes))

export const useAssetType = (id: string | null) =>
  useQuery({
    queryKey: assetKeys.detail('type', id ?? ''),
    queryFn: ({ signal }) => assetsApi.assetType(id ?? '', signal),
    enabled: id !== null,
  })

export const useAssets = (params: PageQuery<AssetFilters>) =>
  useQuery(assetListQueryOptions('items', params, assetsApi.assets))

export const useAsset = (id: string | null) =>
  useQuery({
    queryKey: assetKeys.detail('item', id ?? ''),
    queryFn: ({ signal }) => assetsApi.asset(id ?? '', signal),
    enabled: id !== null,
  })

export const useAssetHistory = (id: string | null) =>
  useQuery({
    queryKey: assetKeys.detail('history', id ?? ''),
    queryFn: ({ signal }) => assetsApi.assetHistory(id ?? '', signal),
    enabled: id !== null,
  })

export const useAllocations = (params: PageQuery<AllocationFilters>) =>
  useQuery(assetListQueryOptions('allocations', params, assetsApi.allocations))

export const useAllocation = (id: string | null) =>
  useQuery({
    queryKey: assetKeys.detail('allocation', id ?? ''),
    queryFn: ({ signal }) => assetsApi.allocation(id ?? '', signal),
    enabled: id !== null,
  })

export const useClearances = (params: PageQuery<ClearanceFilters>) =>
  useQuery(assetListQueryOptions('clearances', params, assetsApi.clearances))

export const useClearance = (id: string | null) =>
  useQuery({
    queryKey: assetKeys.detail('clearance', id ?? ''),
    queryFn: ({ signal }) => assetsApi.clearance(id ?? '', signal),
    enabled: id !== null,
  })

/** A new form's Asset Details for a person (their open allocations). */
export const useClearancePrefill = (employeeId: string | null) =>
  useQuery({
    queryKey: assetKeys.detail('clearance-prefill', employeeId ?? ''),
    queryFn: ({ signal }) => assetsApi.clearancePrefill(employeeId ?? '', signal),
    enabled: employeeId !== null,
  })

// --- mutations ----------------------------------------------------------------------------------

/**
 * An Assets change. Allocations, clearances and End of Employment depend on
 * one another, so both features refetch.
 */
export function useAssetsMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  message: ((variables: TVariables, result: TResult) => string) | null,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    meta: { suppressErrorToast: true },
    onSuccess: async (result, variables) => {
      if (message) toast.success(message(variables, result))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: assetKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['offboarding'] }),
      ])
    },
  })
}

const importMessage = (_variables: unknown, result: ImportResult) =>
  result.errors.length > 0
    ? `${String(result.created)} imported, ${String(result.errors.length)} with errors`
    : `${String(result.created)} imported`

export const useSaveAssetType = () =>
  useAssetsMutation(
    ({ id, input }: { id?: string | undefined; input: AssetTypeInput }) =>
      id ? assetsApi.updateAssetType(id, input) : assetsApi.createAssetType(input),
    ({ id }) => (id ? 'Asset type updated' : 'Asset type created'),
  )

export const useDeleteAssetType = () =>
  useAssetsMutation(
    (id: string) => assetsApi.deleteAssetType(id),
    () => 'Asset type deleted',
  )

export const useSaveAsset = () =>
  useAssetsMutation(
    ({ id, input }: { id?: string | undefined; input: AssetInput }) =>
      id ? assetsApi.updateAsset(id, input) : assetsApi.createAsset(input),
    ({ id }) => (id ? 'Asset updated' : 'Asset created'),
  )

export const useDeleteAsset = () =>
  useAssetsMutation(
    (id: string) => assetsApi.deleteAsset(id),
    () => 'Asset deleted',
  )

export const useSetAssetActive = () =>
  useAssetsMutation(
    ({ id, active }: { id: string; active: boolean }) => assetsApi.setAssetActive(id, active),
    ({ active }) => (active ? 'Asset activated' : 'Asset deactivated'),
  )

export const useImportAssets = () =>
  useAssetsMutation((rows: AssetImportRow[]) => assetsApi.importAssets(rows), importMessage)

export const useAllocate = () =>
  useAssetsMutation(
    (input: AllocationInput) => assetsApi.allocate(input),
    () => 'Asset allocated',
  )

export const useDeallocate = () =>
  useAssetsMutation(
    ({ id, deallocationDate }: { id: string; deallocationDate: string }) =>
      assetsApi.deallocate(id, deallocationDate),
    () => 'Asset deallocated',
  )

export const useSaveClearance = () =>
  useAssetsMutation(
    ({ id, input }: { id?: string | undefined; input: ClearanceInput }) =>
      id ? assetsApi.updateClearance(id, input) : assetsApi.createClearance(input),
    ({ id }) => (id ? 'Clearance form updated' : 'Clearance form created'),
  )

export const useDeleteClearance = () =>
  useAssetsMutation(
    (id: string) => assetsApi.deleteClearance(id),
    () => 'Clearance form deleted',
  )

export const useSetClearancesApproved = () =>
  useAssetsMutation(
    ({ ids, approved }: { ids: string[]; approved: boolean }) =>
      assetsApi.setClearancesApproved(ids, approved),
    ({ approved }, result) =>
      `${String(result.changed)} ${result.changed === 1 ? 'form' : 'forms'} ${approved ? 'approved' : 'unapproved'}`,
  )
