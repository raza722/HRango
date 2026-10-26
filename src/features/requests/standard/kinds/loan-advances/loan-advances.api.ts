import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import { lookupsApi } from '../../../api/lookups.api'
import type { NamedRef } from '../../../types/requests.types'
import { standardKeys } from '../../standard.api'
import type {
  LoanCategory,
  LoanCategoryInput,
  LoanInstallment,
  LoanSettingsLookups,
  LoanSummary,
  LoanType,
  LoanTypeInput,
} from './loan-advances.types'

/*
 * Loan & Advances → Settings on the Loans module: Types and Categories
 * (`/loans/types`, `/loans/categories`: CRUD with rowVersion) and Repayment
 * (`/loans/installments`). The keys sit under the type's own, so an approval
 * (which refetches every key) refreshes Repayment, and a new type reaches the
 * Create form's look-ups.
 */

type Params = Record<string, string | number | boolean | undefined>
type SettingsList = 'types' | 'categories'

const clean = (params: Params) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  )

/** Decimals come as text from the Loans module ("16666.66"). */
export const amount = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export const loanSettingsApi = {
  async list<T>(list: SettingsList | 'installments', params: Params, signal?: AbortSignal) {
    const { data } = await apiClient.get<Paginated<T>>(`/loans/${list}`, {
      params: clean(params),
      signal,
    })
    return data
  },
  async save<T>(list: SettingsList, id: string | undefined, input: object) {
    const { data } = id
      ? await apiClient.put<ApiItem<T>>(`/loans/${list}/${id}`, input)
      : await apiClient.post<ApiItem<T>>(`/loans/${list}`, input)
    return data.data
  },
  async remove(list: SettingsList, id: string, rowVersion: string) {
    await apiClient.delete(`/loans/${list}/${id}`, { params: { rowVersion } })
  },
  /** Total approved, repaid and remaining for one employee (needs loans.loans.view). */
  async summary(employeeId: string, signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiItem<LoanSummary>>('/loans/summary', {
      params: { employeeId },
      signal,
    })
    return data.data
  },
  /** The Type dialog's pickers: employment types, payroll formulas and deduction pay items. */
  async settingsLookups(signal?: AbortSignal): Promise<LoanSettingsLookups> {
    const named = (rows: readonly { id: string; name: string }[]): NamedRef[] =>
      rows.map(({ id, name }) => ({ id, name }))
    const [employmentTypes, formulas, payItems] = await Promise.all([
      lookupsApi.org('employment-types', undefined, signal).catch(() => []),
      apiClient
        .get<Paginated<{ id: string; name: string }>>('/payroll/formulas', {
          params: { pageSize: 100 },
          signal,
        })
        .then(({ data }) => data.data)
        .catch(() => []),
      apiClient
        .get<Paginated<{ id: string; name: string }>>('/payroll/pay-items', {
          params: { itemType: 'deduction', pageSize: 100 },
          signal,
        })
        .then(({ data }) => data.data)
        .catch(() => []),
    ])
    return {
      employmentTypes: named(employmentTypes),
      formulas: named(formulas),
      deductionPayItems: named(payItems),
    }
  },
}

const settingsKey = [...standardKeys.kind('loan-advances'), 'settings'] as const

export const loanSettingsKeys = {
  all: settingsKey,
  list: (list: SettingsList | 'installments', params: Params) =>
    [...settingsKey, list, clean(params)] as const,
  summary: (employeeId: string) => [...settingsKey, 'summary', employeeId] as const,
  lookups: () => [...settingsKey, 'lookups'] as const,
}

const listOptions = <T>(list: SettingsList | 'installments', params: Params) =>
  queryOptions({
    queryKey: loanSettingsKeys.list(list, params),
    queryFn: ({ signal }) => loanSettingsApi.list<T>(list, params, signal),
    placeholderData: keepPreviousData,
  })

export const useLoanTypes = (params: Params) => useQuery(listOptions<LoanType>('types', params))
export const useLoanCategories = (params: Params) =>
  useQuery(listOptions<LoanCategory>('categories', params))
export const useLoanInstallments = (params: Params) =>
  useQuery(listOptions<LoanInstallment>('installments', params))

export const useLoanSummary = (employeeId: string, enabled: boolean) =>
  useQuery({
    queryKey: loanSettingsKeys.summary(employeeId),
    queryFn: ({ signal }) => loanSettingsApi.summary(employeeId, signal),
    enabled,
    retry: false,
  })

export const useLoanSettingsLookups = () =>
  useQuery({
    queryKey: loanSettingsKeys.lookups(),
    queryFn: ({ signal }) => loanSettingsApi.settingsLookups(signal),
    staleTime: 5 * 60_000,
  })

/** Saving or deleting refetches the settings and the type's look-ups (the Create form). */
function useInvalidate() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: standardKeys.kind('loan-advances') })
}

export function useSaveLoanType() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string | undefined; input: LoanTypeInput }) =>
      loanSettingsApi.save<LoanType>('types', id, input),
    meta: { suppressErrorToast: true },
    onSuccess: async (_type, { id }) => {
      toast.success(id ? 'Type updated' : 'Type created')
      await invalidate()
    },
  })
}

export function useSaveLoanCategory() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string | undefined; input: LoanCategoryInput }) =>
      loanSettingsApi.save<LoanCategory>('categories', id, input),
    meta: { suppressErrorToast: true },
    onSuccess: async (_category, { id }) => {
      toast.success(id ? 'Category updated' : 'Category created')
      await invalidate()
    },
  })
}

export function useDeleteLoanSetting(list: SettingsList) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, rowVersion }: { id: string; rowVersion: string }) =>
      loanSettingsApi.remove(list, id, rowVersion),
    onSuccess: async () => {
      toast.success(list === 'types' ? 'Type deleted' : 'Category deleted')
      await invalidate()
    },
  })
}
