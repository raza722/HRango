import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  type BudgetFilters,
  type EmployeeLookupParams,
  type EmployeePositionFilters,
  manpowerApi,
  manpowerKeys,
  manpowerListQueryOptions,
  manpowerLookupsQueryOptions,
  type PageQuery,
  type PlanFilters,
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
  SalaryRangeInput,
} from '../types/manpower.types'

interface Versioned {
  id: string
  rowVersion: string
}

// --- queries ------------------------------------------------------------------------------------

/** Organisation's lists, the budget durations and the employee positions, for the forms. */
export const useManpowerLookups = () => useQuery(manpowerLookupsQueryOptions())

/**
 * Everyone `GET /employees/lookup` gives for these filters (every page), for lists that are
 * not pickers (the HR contacts). Pickers use `EmployeeSearchSelect` (server search, paged).
 */
export const useEmployeeOptions = (
  params: Omit<EmployeeLookupParams, 'page' | 'pageSize'>,
  enabled = true,
) =>
  useQuery({
    queryKey: manpowerKeys.employees(params),
    queryFn: ({ signal }) => manpowerApi.allEmployees(params, signal),
    staleTime: 30_000,
    enabled,
  })

export const usePlans = (params: PageQuery<PlanFilters>) =>
  useQuery(manpowerListQueryOptions('plans', params, manpowerApi.plans))

export const usePlan = (id: string | null) =>
  useQuery({
    queryKey: manpowerKeys.detail('plan', id ?? ''),
    queryFn: ({ signal }) => manpowerApi.plan(id ?? '', signal),
    enabled: id !== null,
  })

export const useBudgets = (params: PageQuery<BudgetFilters>) =>
  useQuery(manpowerListQueryOptions('budgets', params, manpowerApi.budgets))

export const useBudgetApprovals = (params: PageQuery<BudgetFilters>) =>
  useQuery(manpowerListQueryOptions('budget-approvals', params, manpowerApi.budgetApprovals))

export const useOpenPositions = (params: PageQuery<SearchFilters>) =>
  useQuery(manpowerListQueryOptions('open-positions', params, manpowerApi.openPositions))

export const useBudgetDurations = (params: PageQuery<SearchFilters>) =>
  useQuery(manpowerListQueryOptions('durations', params, manpowerApi.durations))

export const usePositionTitles = (params: PageQuery<SearchFilters>) =>
  useQuery(manpowerListQueryOptions('position-titles', params, manpowerApi.positionTitles))

export const useEmployeePositions = (params: PageQuery<EmployeePositionFilters>) =>
  useQuery(manpowerListQueryOptions('positions', params, manpowerApi.positions))

export const useSalaryRanges = (positionId: string) =>
  useQuery({
    queryKey: manpowerKeys.detail('salary-ranges', positionId),
    queryFn: ({ signal }) => manpowerApi.salaryRanges(positionId, signal),
  })

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
    (plan: Versioned) => manpowerApi.deletePlan(plan),
    () => 'Plan deleted',
  )

export const useSaveBudget = () =>
  useManpowerMutation(
    ({ id, input }: { id?: string | undefined; input: BudgetInput }) =>
      id ? manpowerApi.updateBudget(id, input) : manpowerApi.createBudget(input),
    ({ id }) => (id ? 'Budget updated' : 'Budget added'),
  )

export const useDeleteBudget = () =>
  useManpowerMutation(
    (budget: Versioned) => manpowerApi.deleteBudget(budget),
    () => 'Budget deleted',
  )

export const useDecideBudget = () =>
  useManpowerMutation(
    ({
      budget,
      decision,
      remarks,
    }: {
      budget: Versioned
      decision: 'approve' | 'reject'
      remarks?: string
    }) => manpowerApi.decideBudget(budget, decision, remarks),
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
    ({ position, closed }: { position: Versioned; closed: boolean }) =>
      manpowerApi.setOpenPositionClosed(position, closed),
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
    (duration: Versioned) => manpowerApi.deleteDuration(duration),
    () => 'Budget duration deleted',
  )

export const useSavePosition = () =>
  useManpowerMutation(
    ({ id, input }: { id?: string | undefined; input: EmployeePositionInput }) =>
      id ? manpowerApi.updatePosition(id, input) : manpowerApi.createPosition(input),
    ({ id }) => (id ? 'Employee position updated' : 'Employee position saved'),
  )

/** Activate / Deactivate: the position saved again with its other status. */
export const useSetPositionStatus = () =>
  useManpowerMutation(
    ({ id, input }: { id: string; input: EmployeePositionInput }) =>
      manpowerApi.updatePosition(id, input),
    ({ input }) =>
      input.status === 'active' ? 'Employee position activated' : 'Employee position deactivated',
  )

export const useDeletePosition = () =>
  useManpowerMutation(
    (position: Versioned) => manpowerApi.deletePosition(position),
    () => 'Employee position deleted',
  )

export const useAddSalaryRange = () =>
  useManpowerMutation(
    ({ positionId, input }: { positionId: string; input: SalaryRangeInput }) =>
      manpowerApi.addSalaryRange(positionId, input),
    () => 'Salary range saved',
  )

export const useImportPositions = () =>
  useManpowerMutation(
    (rows: EmployeePositionImportRow[]) => manpowerApi.importPositions(rows),
    (_rows, result: ImportResult) => {
      // A row can fail on several fields: count the rows.
      const failed = new Set(result.errors.map((error) => error.rowNo)).size
      return failed > 0
        ? `${String(result.created)} imported, ${String(failed)} with errors`
        : `${String(result.created)} imported`
    },
  )
