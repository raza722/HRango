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

import type {
  ExpenseCategory,
  ExpenseCategoryInput,
  PayItemOption,
  ReimbursementSetting,
  ReimbursementSettingInput,
} from './expense.types'

/*
 * Expense's own calls: the claim form's category options
 * (`GET /requests/expense/categories`, active only; needs requests.expense.create)
 * and Request Settings → Expense Categories / Reimbursement
 * (`/requests/settings/expense-categories`, `/requests/settings/reimbursement`).
 * Reimbursement pay items come from Payroll (`GET /payroll/pay-items?itemType=reimbursement`).
 */

const categoriesPath = '/requests/settings/expense-categories'

export interface CategoryListParams {
  page: number
  pageSize: number
  q?: string | undefined
  isActive?: boolean | undefined
}

const compact = (params: object) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  )

export const expenseApi = {
  /** The Expense Claim Category* dropdown: active categories. */
  async categoryOptions(signal?: AbortSignal) {
    const { data } = await apiClient.get<Paginated<ExpenseCategory>>(
      '/requests/expense/categories',
      { params: { pageSize: 100 }, signal },
    )
    return data.data
  },
  async categories(params: CategoryListParams, signal?: AbortSignal) {
    const { data } = await apiClient.get<Paginated<ExpenseCategory>>(categoriesPath, {
      params: compact(params),
      signal,
    })
    return data
  },
  async saveCategory(id: string | null, input: ExpenseCategoryInput) {
    const { data } = id
      ? await apiClient.put<ApiItem<ExpenseCategory>>(`${categoriesPath}/${id}`, input)
      : await apiClient.post<ApiItem<ExpenseCategory>>(categoriesPath, input)
    return data.data
  },
  async deleteCategory(id: string, rowVersion: string) {
    await apiClient.delete(`${categoriesPath}/${id}`, { params: { rowVersion } })
  },
  async reimbursement(signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiItem<ReimbursementSetting>>(
      '/requests/settings/reimbursement',
      { signal },
    )
    return data.data
  },
  async saveReimbursement(input: ReimbursementSettingInput) {
    const { data } = await apiClient.put<ApiItem<ReimbursementSetting>>(
      '/requests/settings/reimbursement',
      input,
    )
    return data.data
  },
  /** Reimbursement pay items (Payroll; needs payroll.settings.pay_components.view). */
  async payItems(signal?: AbortSignal): Promise<PayItemOption[]> {
    const { data } = await apiClient.get<Paginated<PayItemOption>>('/payroll/pay-items', {
      params: { itemType: 'reimbursement', pageSize: 100 },
      signal,
    })
    return data.data.map(({ id, name }) => ({ id, name }))
  },
}

export const expenseKeys = {
  all: ['requests', 'expense'] as const,
  categories: (params: CategoryListParams) =>
    [...expenseKeys.all, 'categories', compact(params)] as const,
  reimbursement: () => [...expenseKeys.all, 'reimbursement'] as const,
  payItems: () => [...expenseKeys.all, 'pay-items'] as const,
}

export const useExpenseCategories = (params: CategoryListParams) =>
  useQuery(
    queryOptions({
      queryKey: expenseKeys.categories(params),
      queryFn: ({ signal }) => expenseApi.categories(params, signal),
      placeholderData: keepPreviousData,
    }),
  )

export const useReimbursement = (enabled: boolean) =>
  useQuery({
    queryKey: expenseKeys.reimbursement(),
    queryFn: ({ signal }) => expenseApi.reimbursement(signal),
    enabled,
  })

/** Empty when Payroll's pay items cannot be read (the dropdowns then show none). */
export const useReimbursementPayItems = () =>
  useQuery({
    queryKey: expenseKeys.payItems(),
    queryFn: ({ signal }) => expenseApi.payItems(signal).catch(() => []),
    staleTime: 5 * 60_000,
  })

/** Saving a category refreshes the lists and the claim form's options. */
export function useSaveExpenseCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: ExpenseCategoryInput }) =>
      expenseApi.saveCategory(id, input),
    meta: { suppressErrorToast: true },
    onSuccess: async (_result, { id }) => {
      toast.success(id ? 'Category updated' : 'Category created')
      await queryClient.invalidateQueries({ queryKey: ['requests'] })
    },
  })
}

export function useDeleteExpenseCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, rowVersion }: { id: string; rowVersion: string }) =>
      expenseApi.deleteCategory(id, rowVersion),
    onSuccess: async () => {
      toast.success('Category deleted')
      await queryClient.invalidateQueries({ queryKey: ['requests'] })
    },
  })
}

export function useSaveReimbursement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ReimbursementSettingInput) => expenseApi.saveReimbursement(input),
    meta: { suppressErrorToast: true },
    onSuccess: async () => {
      toast.success('Reimbursement pay items saved')
      await queryClient.invalidateQueries({ queryKey: expenseKeys.reimbursement() })
    },
  })
}
