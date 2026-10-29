import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useCan } from '@/lib/permissions'
import { useAuthStore } from '@/stores/auth-store'

import { performanceApi } from '../api/performance.api'
import { PERF_CODES } from '../constants'
import type {
  AppraisalListParams,
  CheckInInput,
  CycleInput,
  CycleListParams,
  FinaliseInput,
  GoalInput,
  GoalListParams,
  KpiInput,
  KpiListParams,
  ReviewInput,
} from '../types/performance.types'
import { performanceKeys } from './performance-keys'

// --- queries ------------------------------------------------------------------------------------

/** The signed-in person's employee id (whose "My" lists and reviews these are). */
export const useMyEmployeeId = () => useAuthStore((state) => state.user?.employeeId ?? null)

/** `GET /performance/overview`: the caller's, or `employeeId`'s. */
export const usePerformanceOverview = (employeeId: string | undefined) =>
  useQuery({
    queryKey: performanceKeys.overview(employeeId),
    queryFn: ({ signal }) => performanceApi.overview(employeeId, signal),
  })

/** One page of goals. */
export const useGoalList = (params: GoalListParams, enabled = true) =>
  useQuery({
    queryKey: performanceKeys.goalList(params),
    queryFn: ({ signal }) => performanceApi.goals(params, signal),
    placeholderData: keepPreviousData,
    enabled,
  })

/** One goal with its check-ins; `null` skips the request. */
export const useGoal = (id: string | null) =>
  useQuery({
    queryKey: performanceKeys.goal(id ?? ''),
    queryFn: ({ signal }) => performanceApi.goal(id ?? '', signal),
    enabled: id !== null,
  })

export const useKpiList = (params: KpiListParams, enabled = true) =>
  useQuery({
    queryKey: performanceKeys.kpiList(params),
    queryFn: ({ signal }) => performanceApi.kpis(params, signal),
    placeholderData: keepPreviousData,
    enabled,
  })

/** One KPI; `null` skips the request. */
export const useKpi = (id: string | null) =>
  useQuery({
    queryKey: performanceKeys.kpi(id ?? ''),
    queryFn: ({ signal }) => performanceApi.kpi(id ?? '', signal),
    enabled: id !== null,
  })

export const useCycleList = (params: CycleListParams, enabled = true) =>
  useQuery({
    queryKey: performanceKeys.cycleList(params),
    queryFn: ({ signal }) => performanceApi.cycles(params, signal),
    placeholderData: keepPreviousData,
    enabled,
  })

/** Every cycle (up to 100), newest first: the cycle pickers of the filters and the goal form. */
export const useCycleOptions = (enabled = true) => useCycleList({ page: 1, pageSize: 100 }, enabled)

export const useCycle = (id: string | null) =>
  useQuery({
    queryKey: performanceKeys.cycle(id ?? ''),
    queryFn: ({ signal }) => performanceApi.cycle(id ?? '', signal),
    enabled: id !== null,
  })

/** The appraisal forms a cycle can use (criteria, rating scale, goals weight, self review). */
export const useAppraisalForms = (enabled = true) =>
  useQuery({
    queryKey: performanceKeys.forms(),
    queryFn: ({ signal }) => performanceApi.forms(signal),
    staleTime: 5 * 60_000,
    enabled,
  })

export const useAppraisalList = (params: AppraisalListParams, enabled = true) =>
  useQuery({
    queryKey: performanceKeys.appraisalList(params),
    queryFn: ({ signal }) => performanceApi.appraisals(params, signal),
    placeholderData: keepPreviousData,
    enabled,
  })

export const useAppraisal = (id: string | null) =>
  useQuery({
    queryKey: performanceKeys.appraisal(id ?? ''),
    queryFn: ({ signal }) => performanceApi.appraisal(id ?? '', signal),
    enabled: id !== null,
  })

export const useReviewList = (params: AppraisalListParams) =>
  useQuery({
    queryKey: performanceKeys.reviewList(params),
    queryFn: ({ signal }) => performanceApi.reviews(params, signal),
    placeholderData: keepPreviousData,
  })

export const useReview = (id: string | null) =>
  useQuery({
    queryKey: performanceKeys.review(id ?? ''),
    queryFn: ({ signal }) => performanceApi.review(id ?? '', signal),
    enabled: id !== null,
  })

/** Departments or job titles for the pickers; an unreadable list comes back empty. */
export const useOrgLookup = (kind: 'departments' | 'job-titles', enabled = true) =>
  useQuery({
    queryKey: performanceKeys.org(kind),
    queryFn: ({ signal }) => performanceApi.orgLookup(kind, signal),
    staleTime: 5 * 60_000,
    enabled,
  })

// --- mutations ----------------------------------------------------------------------------------

/**
 * A Performance change: toasts on success and refetches every Performance query afterwards,
 * failed or not (a 409 means the row changed, so the screens need its new version). Form
 * saves (`showErrors: false`) leave their errors to the form, which puts them on its fields;
 * actions toast them through the app's mutation cache.
 */
function usePerformanceMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  successMessage: string | ((variables: TVariables, result: TResult) => string),
  showErrors = false,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    meta: { suppressErrorToast: !showErrors },
    onSuccess: (result, variables) => {
      toast.success(
        typeof successMessage === 'string' ? successMessage : successMessage(variables, result),
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: performanceKeys.all }),
  })
}

/** Add / Edit goal: `POST /performance/goals` or `PUT /performance/goals/{id}`. */
export const useSaveGoal = () =>
  usePerformanceMutation(
    ({ id, input }: { id?: string | undefined; input: GoalInput }) =>
      id ? performanceApi.updateGoal(id, input) : performanceApi.createGoal(input),
    ({ id }) => (id ? 'Goal updated' : 'Goal added'),
  )

/** `DELETE /performance/goals/{id}?rowVersion=`. */
export const useDeleteGoal = () =>
  usePerformanceMutation(
    ({ id, rowVersion }: { id: string; rowVersion: string; title: string }) =>
      performanceApi.deleteGoal(id, rowVersion),
    ({ title }) => `Goal “${title}” deleted`,
    true,
  )

/** Check In: `POST /performance/goals/{id}/check-ins`. */
export const useCheckIn = () =>
  usePerformanceMutation(
    ({ id, input }: { id: string; input: CheckInInput }) => performanceApi.checkIn(id, input),
    (_variables, goal) => `Checked in: ${goal.title} is at ${String(goal.progress)}%`,
  )

export const useSaveKpi = () =>
  usePerformanceMutation(
    ({ id, input }: { id?: string | undefined; input: KpiInput }) =>
      id ? performanceApi.updateKpi(id, input) : performanceApi.createKpi(input),
    ({ id }) => (id ? 'KPI updated' : 'KPI added'),
  )

export const useDeleteKpi = () =>
  usePerformanceMutation(
    ({ id, rowVersion }: { id: string; rowVersion: string; name: string }) =>
      performanceApi.deleteKpi(id, rowVersion),
    ({ name }) => `KPI “${name}” deleted`,
    true,
  )

export const useSaveCycle = () =>
  usePerformanceMutation(
    ({ id, input }: { id?: string | undefined; input: CycleInput }) =>
      id ? performanceApi.updateCycle(id, input) : performanceApi.createCycle(input),
    ({ id }) => (id ? 'Review cycle updated' : 'Review cycle added'),
  )

export const useDeleteCycle = () =>
  usePerformanceMutation(
    ({ id, rowVersion }: { id: string; rowVersion: string; name: string }) =>
      performanceApi.deleteCycle(id, rowVersion),
    ({ name }) => `Review cycle “${name}” deleted`,
    true,
  )

/** Add Participants: people and / or a whole department. */
export const useAddParticipants = () =>
  usePerformanceMutation(
    ({
      id,
      employeeIds,
      departmentId,
    }: {
      id: string
      employeeIds: string[]
      departmentId: string | null
    }) => performanceApi.addParticipants(id, { employeeIds, departmentId }),
    (_variables, { added }) =>
      added === 0
        ? 'Everyone chosen is already in the cycle'
        : `${String(added)} participant${added === 1 ? '' : 's'} added`,
  )

/** Removes a participant: deletes their appraisal. */
export const useRemoveParticipant = () =>
  usePerformanceMutation(
    ({ id, rowVersion }: { id: string; rowVersion: string; name: string }) =>
      performanceApi.deleteAppraisal(id, rowVersion),
    ({ name }) => `${name} removed from the cycle`,
    true,
  )

export const useLaunchCycle = () =>
  usePerformanceMutation(
    ({ id, rowVersion }: { id: string; rowVersion: string; name: string }) =>
      performanceApi.launchCycle(id, rowVersion),
    ({ name }) => `${name} launched`,
    true,
  )

export const useCloseCycle = () =>
  usePerformanceMutation(
    ({ id, rowVersion }: { id: string; rowVersion: string; name: string }) =>
      performanceApi.closeCycle(id, rowVersion),
    ({ name }) => `${name} closed`,
    true,
  )

/** Finalise: `POST /performance/appraisals/{id}/finalise`. */
export const useFinaliseAppraisal = () =>
  usePerformanceMutation(
    ({ id, input }: { id: string; input: FinaliseInput }) => performanceApi.finalise(id, input),
    (_variables, appraisal) => `Appraisal of ${appraisal.employeeName} finalised`,
  )

/** Self or manager review: save as draft (`submit: false`) or submit. */
export const useSaveReview = () =>
  usePerformanceMutation(
    ({ id, part, input }: { id: string; part: 'self' | 'manager'; input: ReviewInput }) =>
      performanceApi.saveReview(id, part, input),
    ({ part, input }) =>
      input.submit ? `${part === 'self' ? 'Self' : 'Manager'} review submitted` : 'Draft saved',
  )

/** Launch and Close, with whether the user may use them. */
export function useCycleActions() {
  const canLaunch = useCan(PERF_CODES.cyclesLaunch)
  const canClose = useCan(PERF_CODES.cyclesClose)
  const launch = useLaunchCycle()
  const close = useCloseCycle()
  return { canLaunch, canClose, launch, close }
}

/** May the user save a self review, a manager review? */
export function useReviewRights() {
  const self = useCan(PERF_CODES.reviewsSelf)
  const manager = useCan(PERF_CODES.reviewsManager)
  return { self, manager }
}
