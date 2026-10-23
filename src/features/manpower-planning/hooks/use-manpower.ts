import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  type EmployeePositionFilters,
  manpowerApi,
  manpowerKeys,
  manpowerListQueryOptions,
  manpowerLookupsQueryOptions,
  type PageQuery,
  type PlanFilters,
  type PositionTitleFilters,
  type SearchFilters,
} from '../api/manpower.api'
import type {
  BudgetDurationInput,
  BudgetInput,
  EmployeePositionImportRow,
  EmployeePositionInput,
  ImportResult,
  OpenPositionInput,
  PlanInput,
  PositionTitleInput,
} from '../types/manpower.types'

// --- queries ------------------------------------------------------------------------------------

/** Divisions, stations, departments, people, budget durations and positions for the forms. */
export const useManpowerLookups = () => useQuery(manpowerLookupsQueryOptions())

export const usePlans = (params: PageQuery<PlanFilters>) =>
  useQuery(manpowerListQueryOptions('plans', params, manpowerApi.plans))

export const usePlan = (id: string | null) =>
  useQuery({
    queryKey: manpowerKeys.detail('plan', id ?? ''),
    queryFn: ({ signal }) => manpowerApi.plan(id ?? '', signal),
    enabled: id !== null,
  })

export const useBudgets = (params: PageQuery<SearchFilters>) =>
  useQuery(manpowerListQueryOptions('budgets', params, manpowerApi.budgets))

export const useOpenPositions = (params: PageQuery<SearchFilters>) =>
  useQuery(manpowerListQueryOptions('open-positions', params, manpowerApi.openPositions))

export const useBudgetDurations = (params: PageQuery<SearchFilters>) =>
  useQuery(manpowerListQueryOptions('durations', params, manpowerApi.durations))

export const usePositionTitles = (params: PageQuery<PositionTitleFilters>) =>
  useQuery(manpowerListQueryOptions('position-titles', params, manpowerApi.positionTitles))

export const useEmployeePositions = (params: PageQuery<EmployeePositionFilters>) =>
  useQuery(manpowerListQueryOptions('positions', params, manpowerApi.positions))

// --- mutations ----------------------------------------------------------------------------------

/**
 * A Manpower Planning change. Plans, budgets, approvals, open positions and the
 * settings feed one another, so the whole module refetches. Errors are shown by
 * the caller (a field message or a toast).
 */
export function useManpowerMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  message: ((variables: TVariables, result: TResult) => string) | null,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    meta: { suppressErrorToast: true },
    onSuccess: async (result, variables) => {
      if (message) toast.success(message(variables, result))
      await queryClient.invalidateQueries({ queryKey: manpowerKeys.all })
    },
  })
}

export const useSavePlan = () =>
  useManpowerMutation(
    ({ id, input }: { id?: string | undefined; input: PlanInput }) =>
      id ? manpowerApi.updatePlan(id, input) : manpowerApi.createPlan(input),
    ({ id }) => (id ? 'Plan updated and sent for approval' : 'Plan submitted for approval'),
  )

export const useDeletePlan = () =>
  useManpowerMutation(
    (id: string) => manpowerApi.deletePlan(id),
    () => 'Plan deleted',
  )

export const useUpdateBudget = () =>
  useManpowerMutation(
    ({ id, input }: { id: string; input: BudgetInput }) => manpowerApi.updateBudget(id, input),
    () => 'Budget updated',
  )

export const useDeleteBudget = () =>
  useManpowerMutation(
    (id: string) => manpowerApi.deleteBudget(id),
    () => 'Budget deleted',
  )

export const useDecideBudget = () =>
  useManpowerMutation(
    ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) =>
      manpowerApi.decideBudget(id, decision),
    ({ decision }) => (decision === 'approve' ? 'Budget approved' : 'Budget rejected'),
  )

export const useUpdateOpenPosition = () =>
  useManpowerMutation(
    ({ id, input }: { id: string; input: OpenPositionInput }) =>
      manpowerApi.updateOpenPosition(id, input),
    () => 'Open position updated',
  )

export const useSetOpenPositionClosed = () =>
  useManpowerMutation(
    ({ id, closed }: { id: string; closed: boolean }) =>
      manpowerApi.setOpenPositionClosed(id, closed),
    ({ closed }) => (closed ? 'Position closed' : 'Position reopened'),
  )

export const useSaveDuration = () =>
  useManpowerMutation(
    ({ id, input }: { id?: string | undefined; input: BudgetDurationInput }) =>
      id ? manpowerApi.updateDuration(id, input) : manpowerApi.createDuration(input),
    ({ id }) => (id ? 'Budget duration updated' : 'Budget duration added'),
  )

export const useDeleteDuration = () =>
  useManpowerMutation(
    (id: string) => manpowerApi.deleteDuration(id),
    () => 'Budget duration deleted',
  )

export const useSavePositionTitle = () =>
  useManpowerMutation(
    ({ id, input }: { id?: string | undefined; input: PositionTitleInput }) =>
      id ? manpowerApi.updatePositionTitle(id, input) : manpowerApi.createPositionTitle(input),
    ({ id }) => (id ? 'Position title updated' : 'Position title added'),
  )

export const useSetPositionTitleActive = () =>
  useManpowerMutation(
    ({ id, active }: { id: string; active: boolean }) =>
      manpowerApi.setPositionTitleActive(id, active),
    ({ active }) => (active ? 'Position title activated' : 'Position title deactivated'),
  )

export const useDeletePositionTitle = () =>
  useManpowerMutation(
    (id: string) => manpowerApi.deletePositionTitle(id),
    () => 'Position title deleted',
  )

export const useSavePosition = () =>
  useManpowerMutation(
    ({ id, input }: { id?: string | undefined; input: EmployeePositionInput }) =>
      id ? manpowerApi.updatePosition(id, input) : manpowerApi.createPosition(input),
    ({ id }) => (id ? 'Employee position updated' : 'Employee position saved'),
  )

export const useSetPositionActive = () =>
  useManpowerMutation(
    ({ id, active }: { id: string; active: boolean }) => manpowerApi.setPositionActive(id, active),
    ({ active }) => (active ? 'Employee position activated' : 'Employee position deactivated'),
  )

export const useDeletePosition = () =>
  useManpowerMutation(
    (id: string) => manpowerApi.deletePosition(id),
    () => 'Employee position deleted',
  )

export const useImportPositions = () =>
  useManpowerMutation(
    (rows: EmployeePositionImportRow[]) => manpowerApi.importPositions(rows),
    (_rows, result: ImportResult) =>
      result.errors.length > 0
        ? `${String(result.created)} imported, ${String(result.errors.length)} with errors`
        : `${String(result.created)} imported`,
  )
