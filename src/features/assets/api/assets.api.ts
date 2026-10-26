import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  Allocation,
  AllocationInput,
  Asset,
  AssetHistoryRow,
  AssetInput,
  AssetType,
  AssetTypeInput,
  Clearance,
  ClearanceInput,
  ClearancePrefill,
  ClearanceRef,
  ClearanceRow,
  DeallocateInput,
} from '../types/assets.types'

/** Query values: only what is set, so keys and URLs stay short. */
export function compact<T extends object>(params: T): Partial<T> {
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

async function send<T>(method: 'post' | 'put' | 'patch', url: string, body?: unknown) {
  const { data } = await apiClient[method]<ApiItem<T>>(path(url), body ?? {})
  return data.data
}

async function remove(url: string, rowVersion: string) {
  await apiClient.delete(path(url), { params: { rowVersion } })
}

export interface ListParams {
  page: number
  pageSize: number
}

export type PageQuery<F> = ListParams & F

export interface AssetTypeFilters {
  q?: string | undefined
  isActive?: boolean | undefined
}

export interface AssetFilters {
  q?: string | undefined
  status?: string | undefined
  availability?: string | undefined
  assetTypeId?: string | undefined
}

export interface AllocationFilters {
  q?: string | undefined
  employeeId?: string | undefined
  assetTypeId?: string | undefined
  assetId?: string | undefined
  status?: string | undefined
  from?: string | undefined
  to?: string | undefined
}

export interface ClearanceFilters {
  q?: string | undefined
  status?: string | undefined
  employeeId?: string | undefined
  departmentId?: string | undefined
  endOfEmploymentId?: string | undefined
}

/** A record and the rowVersion it was read with (edits and deletes send it back). */
export interface Versioned {
  id: string
  rowVersion: string
}

export const assetsApi = {
  // Asset Types
  assetTypes: (params: PageQuery<AssetTypeFilters>, signal?: AbortSignal) =>
    getPage<AssetType>('/types', params, signal),
  assetType: (id: string, signal?: AbortSignal) =>
    getData<AssetType>(`/types/${id}`, undefined, signal),
  createAssetType: (input: AssetTypeInput) => send<AssetType>('post', '/types', input),
  updateAssetType: (id: string, input: AssetTypeInput) =>
    send<AssetType>('put', `/types/${id}`, input),
  deleteAssetType: ({ id, rowVersion }: Versioned) => remove(`/types/${id}`, rowVersion),

  // Company Assets
  assets: (params: PageQuery<AssetFilters>, signal?: AbortSignal) =>
    getPage<Asset>('/company-assets', params, signal),
  asset: (id: string, signal?: AbortSignal) =>
    getData<Asset>(`/company-assets/${id}`, undefined, signal),
  assetHistory: (id: string, signal?: AbortSignal) =>
    getData<AssetHistoryRow[]>(`/company-assets/${id}/history`, undefined, signal),
  createAsset: (input: AssetInput) => send<Asset>('post', '/company-assets', input),
  updateAsset: (id: string, input: AssetInput) =>
    send<Asset>('put', `/company-assets/${id}`, input),
  deleteAsset: ({ id, rowVersion }: Versioned) => remove(`/company-assets/${id}`, rowVersion),
  /** Deactivate (decommissioned), or Activate again. */
  setAssetActive: ({ id, rowVersion }: Versioned, active: boolean) =>
    send<Asset>('patch', `/company-assets/${id}/${active ? 'activate' : 'deactivate'}`, {
      rowVersion,
    }),

  // Asset Allocations
  allocations: (params: PageQuery<AllocationFilters>, signal?: AbortSignal) =>
    getPage<Allocation>('/allocations', params, signal),
  allocation: (id: string, signal?: AbortSignal) =>
    getData<Allocation>(`/allocations/${id}`, undefined, signal),
  allocate: (input: AllocationInput) => send<Allocation>('post', '/allocations', input),
  deallocate: (id: string, input: DeallocateInput) =>
    send<Allocation>('patch', `/allocations/${id}/deallocate`, input),

  // Asset Clearance Form
  clearances: (params: PageQuery<ClearanceFilters>, signal?: AbortSignal) =>
    getPage<ClearanceRow>('/clearance-forms', params, signal),
  clearance: (id: string, signal?: AbortSignal) =>
    getData<Clearance>(`/clearance-forms/${id}`, undefined, signal),
  clearancePrefill: (employeeId: string, signal?: AbortSignal) =>
    getData<ClearancePrefill>('/clearance-forms/prefill', { employeeId }, signal),
  createClearance: (input: ClearanceInput) => send<Clearance>('post', '/clearance-forms', input),
  updateClearance: (id: string, input: ClearanceInput) =>
    send<Clearance>('put', `/clearance-forms/${id}`, input),
  deleteClearance: ({ id, rowVersion }: Versioned) => remove(`/clearance-forms/${id}`, rowVersion),
  /** Bulk Approve / Unapprove on the ticked rows: all or nothing. */
  setClearancesApproved: (forms: ClearanceRef[], approved: boolean) =>
    send<ClearanceRow[]>('patch', `/clearance-forms/${approved ? 'approve' : 'unapprove'}`, {
      forms,
    }),
}

export const assetKeys = {
  all: ['assets'] as const,
  list: (name: string, params?: object) =>
    params
      ? ([...assetKeys.all, name, compact(params)] as const)
      : ([...assetKeys.all, name] as const),
  detail: (name: string, id: string) => [...assetKeys.all, name, 'detail', id] as const,
}

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

/** Rows for a picker (the API's page maximum). */
export const PICKER_PAGE = { page: 1, pageSize: 100 } as const
