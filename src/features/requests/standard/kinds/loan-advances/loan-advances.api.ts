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

import { standardKeys } from '../../standard.api'
import type {
  LoanCategory,
  LoanCategoryInput,
  LoanRepayment,
  LoanType,
  LoanTypeInput,
} from './loan-advances.types'

/*
 * Loan & Advances → Settings: Types and Categories (CRUD) and the Repayment
 * schedule of the approved loans. The keys sit under the type's own, so an
 * approval (which refetches every standard key) refreshes Repayment, and a
 * new type reaches the Create form's look-ups.
 */

type Params = Record<string, string | number | undefined>

const path = (suffix: string) => `/requests/loan-advances/settings${suffix}`
const clean = (params: Params) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  )

export const loanSettingsApi = {
  async list<T>(list: 'types' | 'categories' | 'repayments', params: Params, signal?: AbortSignal) {
    const { data } = await apiClient.get<Paginated<T>>(path(`/${list}`), {
      params: clean(params),
      signal,
    })
    return data
  },
  async save<T>(list: 'types' | 'categories', id: string | undefined, input: object) {
    const { data } = id
      ? await apiClient.put<ApiItem<T>>(path(`/${list}/${id}`), input)
      : await apiClient.post<ApiItem<T>>(path(`/${list}`), input)
    return data.data
  },
  async remove(list: 'types' | 'categories', id: string) {
    await apiClient.delete(path(`/${list}/${id}`))
  },
}

const settingsKey = [...standardKeys.kind('loan-advances'), 'settings'] as const

export const loanSettingsKeys = {
  all: settingsKey,
  list: (list: 'types' | 'categories' | 'repayments', params: Params) =>
    [...settingsKey, list, clean(params)] as const,
}

const listOptions = <T>(list: 'types' | 'categories' | 'repayments', params: Params) =>
  queryOptions({
    queryKey: loanSettingsKeys.list(list, params),
    queryFn: ({ signal }) => loanSettingsApi.list<T>(list, params, signal),
    placeholderData: keepPreviousData,
  })

export const useLoanTypes = (params: Params) => useQuery(listOptions<LoanType>('types', params))
export const useLoanCategories = (params: Params) =>
  useQuery(listOptions<LoanCategory>('categories', params))
export const useLoanRepayments = (params: Params) =>
  useQuery(listOptions<LoanRepayment>('repayments', params))

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

export function useDeleteLoanSetting(list: 'types' | 'categories') {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => loanSettingsApi.remove(list, id),
    onSuccess: async () => {
      toast.success(list === 'types' ? 'Type deleted' : 'Category deleted')
      await invalidate()
    },
  })
}
