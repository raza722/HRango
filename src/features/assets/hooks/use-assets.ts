import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  type AllocationFilters,
  type AssetFilters,
  assetKeys,
  assetListQueryOptions,
  assetsApi,
  type AssetTypeFilters,
  type ClearanceFilters,
  type PageQuery,
  PICKER_PAGE,
  type Versioned,
} from '../api/assets.api'
import type {
  AllocationInput,
  AssetInput,
  AssetType,
  AssetTypeInput,
  ClearanceInput,
  ClearanceRef,
  DeallocateInput,
} from '../types/assets.types'

// --- queries ------------------------------------------------------------------------------------

export const useAssetTypes = (params: PageQuery<AssetTypeFilters>) =>
  useQuery(assetListQueryOptions('types', params, assetsApi.assetTypes))

/** Every asset type (up to the page maximum), for pickers and filters. */
export const useAssetTypeOptions = () =>
  useQuery({
    ...assetListQueryOptions('types', PICKER_PAGE, assetsApi.assetTypes),
    staleTime: 30_000,
    select: (page) => page.data,
  })

export const useAssetType = (id: string | null) =>
  useQuery({
    queryKey: assetKeys.detail('type', id ?? ''),
    queryFn: ({ signal }) => assetsApi.assetType(id ?? '', signal),
    enabled: id !== null,
  })

export const useAssets = (params: PageQuery<AssetFilters>) =>
  useQuery(assetListQueryOptions('company-assets', params, assetsApi.assets))

/** Assets for a picker, e.g. the available ones of a type; `enabled: false` skips the call. */
export const useAssetOptions = (filters: AssetFilters, enabled = true) =>
  useQuery({
    ...assetListQueryOptions('company-assets', { ...PICKER_PAGE, ...filters }, assetsApi.assets),
    enabled,
    select: (page) => page.data,
  })

export const useAsset = (id: string | null) =>
  useQuery({
    queryKey: assetKeys.detail('company-asset', id ?? ''),
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

/**
 * Whether each asset was ever allocated (an allocation, open or returned, names it): such an
 * asset cannot be deleted. `undefined` while its answer loads.
 */
export function useEverAllocated(assetIds: readonly string[], enabled: boolean) {
  const results = useQueries({
    queries: assetIds.map((assetId) => ({
      ...assetListQueryOptions(
        'allocations',
        { page: 1, pageSize: 1, assetId },
        assetsApi.allocations,
      ),
      enabled,
    })),
  })
  return new Map(
    assetIds.map((id, index) => {
      const data = results[index]?.data
      return [id, data ? data.meta.total > 0 : undefined] as const
    }),
  )
}

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

export const useSaveAssetType = () =>
  useAssetsMutation(
    ({ id, input }: { id?: string | undefined; input: AssetTypeInput }) =>
      id ? assetsApi.updateAssetType(id, input) : assetsApi.createAssetType(input),
    ({ id }) => (id ? 'Asset type updated' : 'Asset type created'),
  )

export const useDeleteAssetType = () =>
  useAssetsMutation(
    (record: Versioned) => assetsApi.deleteAssetType(record),
    () => 'Asset type deleted',
  )

/** Deactivate (or Activate) a type: an in-use type cannot be deleted, so it is retired. */
export const useSetAssetTypeActive = () =>
  useAssetsMutation(
    ({ record, active }: { record: AssetType; active: boolean }) =>
      assetsApi.updateAssetType(record.id, {
        name: record.name,
        description: record.description,
        isActive: active,
        rowVersion: record.rowVersion,
      }),
    ({ active }) => (active ? 'Asset type activated' : 'Asset type deactivated'),
  )

export const useSaveAsset = () =>
  useAssetsMutation(
    ({ id, input }: { id?: string | undefined; input: AssetInput }) =>
      id ? assetsApi.updateAsset(id, input) : assetsApi.createAsset(input),
    ({ id }) => (id ? 'Asset updated' : 'Asset created'),
  )

export const useDeleteAsset = () =>
  useAssetsMutation(
    (record: Versioned) => assetsApi.deleteAsset(record),
    () => 'Asset deleted',
  )

export const useSetAssetActive = () =>
  useAssetsMutation(
    ({ record, active }: { record: Versioned; active: boolean }) =>
      assetsApi.setAssetActive(record, active),
    ({ active }) => (active ? 'Asset activated' : 'Asset deactivated'),
  )

export const useAllocate = () =>
  useAssetsMutation(
    (input: AllocationInput) => assetsApi.allocate(input),
    () => 'Asset allocated',
  )

export const useDeallocate = () =>
  useAssetsMutation(
    ({ id, input }: { id: string; input: DeallocateInput }) => assetsApi.deallocate(id, input),
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
    (record: Versioned) => assetsApi.deleteClearance(record),
    () => 'Clearance form deleted',
  )

export const useSetClearancesApproved = () =>
  useAssetsMutation(
    ({ forms, approved }: { forms: ClearanceRef[]; approved: boolean }) =>
      assetsApi.setClearancesApproved(forms, approved),
    ({ approved }, result) =>
      `${String(result.length)} ${result.length === 1 ? 'form' : 'forms'} ${approved ? 'approved' : 'unapproved'}`,
  )
