import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { toast } from 'sonner'

import {
  leaveApplicationCountsQueryOptions,
  leaveApplicationQueryOptions,
  leaveApplicationsQueryOptions,
  leaveBalancesQueryOptions,
  leavePoliciesQueryOptions,
  leaveRequestQueryOptions,
  leavesApi,
  leaveSettingsQueryOptions,
  leavesKeys,
  leaveTypesQueryOptions,
} from '../api/leaves.api'
import type {
  AllotmentInput,
  CarryForwardInput,
  LeaveApplicationListParams,
  LeaveBalanceParams,
  LeaveDecisionInput,
  LeavePolicyInput,
  LeavePolicyListParams,
  LeaveRequestInput,
  LeaveSettingsInput,
  LeaveTypeInput,
  LeaveTypeListParams,
} from '../types/leaves.types'

export const useLeaveApplications = (params: LeaveApplicationListParams) =>
  useQuery(leaveApplicationsQueryOptions(params))

export const useLeaveApplicationCounts = (
  params: Pick<LeaveApplicationListParams, 'tab' | 'filters'>,
) => useQuery(leaveApplicationCountsQueryOptions(params))

export const useLeaveApplication = (id: string) => useQuery(leaveApplicationQueryOptions(id))

/** The request behind an application (steps, attachments, actions, rowVersion). */
export const useLeaveRequest = (id: string, enabled = true) =>
  useQuery({ ...leaveRequestQueryOptions(id), enabled })

/** Ids of the leave requests waiting for the caller's decision (Approve/Reject in the row menu). */
export const useLeaveWaitingIds = (enabled = true) =>
  useQuery({
    queryKey: leavesKeys.waiting(),
    queryFn: ({ signal }) => leavesApi.waitingIds(signal),
    select: (ids) => new Set(ids),
    enabled,
  })

/** Longest span Apply Leave reads the schedule for (61 days, widened to whole weeks). */
const MAX_SCHEDULE_DAYS = 76

/**
 * The person's shifts, holidays and rest days between two dates (Scheduling's board), for the
 * days a leave does not count. `employeeId` undefined: the signed-in person.
 */
export function useLeaveSchedule(
  employeeId: string | undefined,
  from: string,
  to: string,
  enabled = true,
) {
  const span =
    from && to && to >= from ? differenceInCalendarDays(parseISO(to), parseISO(from)) : -1
  return useQuery({
    queryKey: leavesKeys.schedule(employeeId, from, to),
    queryFn: ({ signal }) => leavesApi.scheduleDays(employeeId, from, to, signal),
    enabled: enabled && span >= 0 && span < MAX_SCHEDULE_DAYS,
    staleTime: 60_000,
  })
}

export const useLeaveSettings = () => useQuery(leaveSettingsQueryOptions())

export const useLeaveTypes = (params: LeaveTypeListParams) =>
  useQuery(leaveTypesQueryOptions(params))

/** Every leave type (pickers and filters): the list endpoint's largest page. */
export const useAllLeaveTypes = (enabled = true) =>
  useQuery({ ...leaveTypesQueryOptions({ page: 1, pageSize: 100 }), enabled })

export const useLeavePolicies = (params: LeavePolicyListParams) =>
  useQuery(leavePoliciesQueryOptions(params))

export const useLeaveBalances = (params: LeaveBalanceParams, enabled = true) =>
  useQuery({ ...leaveBalancesQueryOptions(params), enabled })

export const useEnrolledEmployees = (policyId: string) =>
  useQuery({
    queryKey: leavesKeys.enrolled(policyId),
    queryFn: ({ signal }) => leavesApi.enrolled(policyId, signal),
  })

/** The people a picker offers: those the caller reaches through `permission`. */
export const useEmployeeLookup = (permission: string, enabled = true) =>
  useQuery({
    queryKey: leavesKeys.employees(permission),
    queryFn: ({ signal }) => leavesApi.employees(permission, undefined, signal),
    staleTime: 60_000,
    enabled,
  })

/** The Apply form's leave types for a person (`GET /requests/options/leave-types`). */
export const useLeaveTypeOptions = (
  employeeId: string | undefined,
  asOf: string | undefined,
  enabled = true,
) =>
  useQuery({
    queryKey: leavesKeys.typeOptions(employeeId, asOf),
    queryFn: ({ signal }) => leavesApi.leaveTypeOptions(employeeId, asOf, signal),
    enabled,
  })

export const useDepartmentLookup = (enabled = true) =>
  useQuery({
    queryKey: leavesKeys.departments(),
    queryFn: ({ signal }) => leavesApi.departments(signal),
    staleTime: 60_000,
    enabled,
  })

/**
 * A mutation of leave requests: toasts its own success, leaves errors to the form (inline),
 * and refetches everything on success, since a leave request also changes Requests → Leave,
 * the approvals and the balances.
 */
function useRequestMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  successMessage: string | undefined,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    meta: { successMessage, suppressErrorToast: true },
    onSuccess: async () => {
      await queryClient.invalidateQueries()
    },
  })
}

/** "+ Apply Leave": `POST /requests/leave`. */
export const useApplyLeave = () =>
  useRequestMutation((input: LeaveRequestInput) => leavesApi.apply(input), 'Leave applied')

/** Approve / Reject on Leave Applications: `POST /requests/approvals/{id}/approve|reject`. */
export const useDecideLeave = () =>
  useRequestMutation(
    ({ id, input }: { id: string; input: LeaveDecisionInput }) => leavesApi.decide(id, input),
    undefined,
  )

/** Cancel: `POST /requests/leave/{id}/cancel` (withdraws a pending one, asks to cancel an approved one). */
export const useCancelLeave = () =>
  useRequestMutation(
    ({ id, reason, rowVersion }: { id: string; reason: string; rowVersion: string }) =>
      leavesApi.cancel(id, reason, rowVersion),
    'Cancellation recorded',
  )

/** A Settings mutation: refetches the Leaves queries on success. */
function useSettingsMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  successMessage: string | undefined,
  suppressErrorToast = true,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    meta: { successMessage, suppressErrorToast },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: leavesKeys.all })
    },
  })
}

export const useSaveLeaveSettings = () =>
  useSettingsMutation(
    (input: LeaveSettingsInput) => leavesApi.saveSettings(input),
    'Settings saved',
  )

export function useSaveLeaveType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string | undefined; input: LeaveTypeInput }) =>
      id ? leavesApi.updateType(id, input) : leavesApi.createType(input),
    meta: { suppressErrorToast: true },
    onSuccess: async (_type, { id }) => {
      toast.success(id ? 'Leave type updated' : 'Leave type created')
      await queryClient.invalidateQueries({ queryKey: leavesKeys.all })
    },
  })
}

/** Delete on Leave Types: refused by the server while the type is in use. */
export const useDeleteLeaveType = () =>
  useSettingsMutation(
    ({ id, rowVersion }: { id: string; rowVersion: string }) =>
      leavesApi.deleteType(id, rowVersion),
    'Leave type deleted',
    false,
  )

export function useSaveLeavePolicy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string | undefined; input: LeavePolicyInput }) =>
      id ? leavesApi.updatePolicy(id, input) : leavesApi.createPolicy(input),
    meta: { suppressErrorToast: true },
    onSuccess: async (_policy, { id }) => {
      toast.success(id ? 'Policy updated' : 'Policy created')
      await queryClient.invalidateQueries({ queryKey: leavesKeys.all })
    },
  })
}

export const useDeleteLeavePolicy = () =>
  useSettingsMutation(
    ({ id, rowVersion }: { id: string; rowVersion: string }) =>
      leavesApi.deletePolicy(id, rowVersion),
    'Policy deleted',
    false,
  )

/** Enroll Employee: adds the new people (`POST`) and removes the dropped ones (`DELETE` each). */
export const useEnrollEmployees = () =>
  useSettingsMutation(
    async ({ id, add, remove }: { id: string; add: string[]; remove: string[] }) => {
      if (add.length > 0) await leavesApi.enrol(id, add)
      for (const employeeId of remove) await leavesApi.unenrol(id, employeeId)
    },
    'Enrollment saved',
  )

export const useProcessAllotment = () =>
  useSettingsMutation((input: AllotmentInput) => leavesApi.processAllotment(input), undefined)

export const useProcessCarryForward = () =>
  useSettingsMutation((input: CarryForwardInput) => leavesApi.processCarryForward(input), undefined)
