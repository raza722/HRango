import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  AllocationDetail,
  AllocationInput,
  AllocationRow,
  AssetDetail,
  AssetHistoryRow,
  AssetImportRow,
  AssetInput,
  AssetLookups,
  AssetRow,
  AssetType,
  AssetTypeInput,
  ClearanceDetail,
  ClearanceInput,
  ClearancePrefill,
  ClearanceRow,
  ListParams,
} from '../types/assets.types'

/** Query values: only what is set, so keys and URLs stay short. */
function compact<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== '' && value !== null,
    ),
  ) as Partial<T>
}

const path = (rest: string) => `/assets${rest}`

async function getData<T>(url: string, params?: object, signal?: AbortSignal) {
  const { data } = await apiClient.get<ApiItem<T>>(path(url), {
    ...(params ? { params: compact(params) } : {}),
    signal,
  })
  return data.data
}

async function getPage<T>(url: string, params: object, signal?: AbortSignal) {
  const { data } = await apiClient.get<Paginated<T>>(path(url), { params: compact(params), signal })
  return data
}

async function send<T>(method: 'post' | 'put', url: string, body?: unknown) {
  const { data } = await apiClient[method]<ApiItem<T>>(path(url), body ?? {})
  return data.data
}

async function remove(url: string) {
  await apiClient.delete(path(url))
}

export type PageQuery<F> = ListParams & F

export interface AssetFilters {
  status?: string | undefined
  name?: string | undefined
  code?: string | undefined
  identificationNumber?: string | undefined
  assetTypeId?: string | undefined
}

export interface AssetTypeFilters {
  status?: string | undefined
  name?: string | undefined
}

export interface AllocationFilters {
  employeeId?: string | undefined
  assetTypeId?: string | undefined
  status?: string | undefined
  assetId?: string | undefined
  from?: string | undefined
  to?: string | undefined
}

export interface ClearanceFilters {
  code?: string | undefined
  name?: string | undefined
  department?: string | undefined
  clearanceDate?: string | undefined
}

export interface ImportResult {
  created: number
  errors: string[]
}

export const assetsApi = {
  lookups: (signal?: AbortSignal) => getData<AssetLookups>('/lookups', undefined, signal),

  // Asset Types
  assetTypes: (params: PageQuery<AssetTypeFilters>, signal?: AbortSignal) =>
    getPage<AssetType>('/types', params, signal),
  assetType: (id: string, signal?: AbortSignal) =>
    getData<AssetType>(`/types/${id}`, undefined, signal),
  createAssetType: (input: AssetTypeInput) => send<AssetType>('post', '/types', input),
  updateAssetType: (id: string, input: AssetTypeInput) =>
    send<AssetType>('put', `/types/${id}`, input),
  deleteAssetType: (id: string) => remove(`/types/${id}`),

  // Company Assets
  assets: (params: PageQuery<AssetFilters>, signal?: AbortSignal) =>
    getPage<AssetRow>('/items', params, signal),
  asset: (id: string, signal?: AbortSignal) =>
    getData<AssetDetail>(`/items/${id}`, undefined, signal),
  assetHistory: (id: string, signal?: AbortSignal) =>
    getData<AssetHistoryRow[]>(`/items/${id}/history`, undefined, signal),
  createAsset: (input: AssetInput) => send<AssetDetail>('post', '/items', input),
  updateAsset: (id: string, input: AssetInput) => send<AssetDetail>('put', `/items/${id}`, input),
  deleteAsset: (id: string) => remove(`/items/${id}`),
  /** Deactivate, or Activate again. */
  setAssetActive: (id: string, active: boolean) =>
    send<AssetDetail>('post', `/items/${id}/${active ? 'activate' : 'deactivate'}`),
  importAssets: (rows: AssetImportRow[]) => send<ImportResult>('post', '/items/import', { rows }),

  // Asset Allocations
  allocations: (params: PageQuery<AllocationFilters>, signal?: AbortSignal) =>
    getPage<AllocationRow>('/allocations', params, signal),
  allocation: (id: string, signal?: AbortSignal) =>
    getData<AllocationDetail>(`/allocations/${id}`, undefined, signal),
  allocate: (input: AllocationInput) => send<AllocationDetail>('post', '/allocations', input),
  deallocate: (id: string, deallocationDate: string) =>
    send<AllocationDetail>('post', `/allocations/${id}/deallocate`, { deallocationDate }),

  // Asset Clearance Form
  clearances: (params: PageQuery<ClearanceFilters>, signal?: AbortSignal) =>
    getPage<ClearanceRow>('/clearances', params, signal),
  clearance: (id: string, signal?: AbortSignal) =>
    getData<ClearanceDetail>(`/clearances/${id}`, undefined, signal),
  clearancePrefill: (employeeId: string, signal?: AbortSignal) =>
    getData<ClearancePrefill>(`/clearances/prefill/${employeeId}`, undefined, signal),
  createClearance: (input: ClearanceInput) => send<ClearanceDetail>('post', '/clearances', input),
  updateClearance: (id: string, input: ClearanceInput) =>
    send<ClearanceDetail>('put', `/clearances/${id}`, input),
  deleteClearance: (id: string) => remove(`/clearances/${id}`),
  /** Bulk "Approved" / "Unapproved" on the ticked rows. */
  setClearancesApproved: (ids: string[], approved: boolean) =>
    send<{ changed: number }>('post', `/clearances/${approved ? 'approve' : 'unapprove'}`, {
      ids,
    }),
}

export const assetKeys = {
  all: ['assets'] as const,
  lookups: () => [...assetKeys.all, 'lookups'] as const,
  list: (name: string, params?: object) =>
    params
      ? ([...assetKeys.all, name, compact(params)] as const)
      : ([...assetKeys.all, name] as const),
  detail: (name: string, id: string) => [...assetKeys.all, name, 'detail', id] as const,
}

export const assetLookupsQueryOptions = () =>
  queryOptions({
    queryKey: assetKeys.lookups(),
    queryFn: ({ signal }) => assetsApi.lookups(signal),
    staleTime: 30_000,
  })

/** A paginated list; `fetch` is the matching `assetsApi` call. */
export const assetListQueryOptions = <TRow, TParams extends object>(
  name: string,
  params: TParams,
  fetch: (params: TParams, signal?: AbortSignal) => Promise<Paginated<TRow>>,
) =>
  queryOptions({
    queryKey: assetKeys.list(name, params),
    queryFn: ({ signal }) => fetch(params, signal),
    placeholderData: keepPreviousData,
  })
