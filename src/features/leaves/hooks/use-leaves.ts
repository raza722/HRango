import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  leaveApplicationQueryOptions,
  leaveApplicationsQueryOptions,
  leavePoliciesQueryOptions,
  leavesApi,
  leaveSettingsQueryOptions,
  leavesKeys,
  leavesLookupsQueryOptions,
  leaveTypesQueryOptions,
} from '../api/leaves.api'
import type {
  LeaveApplicationListParams,
  LeaveApplyInput,
  LeaveDecisionInput,
  LeavePolicyInput,
  LeaveSettings,
  LeaveTypeInput,
  LeaveTypeListParams,
} from '../types/leaves.types'

export const useLeavesLookups = () => useQuery(leavesLookupsQueryOptions())

export const useLeaveApplications = (params: LeaveApplicationListParams) =>
  useQuery(leaveApplicationsQueryOptions(params))

export const useLeaveApplication = (id: string) => useQuery(leaveApplicationQueryOptions(id))

export const useLeaveSettings = () => useQuery(leaveSettingsQueryOptions())

export const useLeaveTypes = (params: LeaveTypeListParams) =>
  useQuery(leaveTypesQueryOptions(params))

export const useLeavePolicies = (params: { page: number; pageSize: number }) =>
  useQuery(leavePoliciesQueryOptions(params))

/**
 * A Leaves mutation: toasts its own success, leaves errors to the form
 * (inline), and refetches everything on success, since a leave decision also
 * changes Requests → Leave and the balances.
 */
function useLeavesMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  successMessage: string,
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

/** "+ Apply Leave". */
export const useApplyLeave = () =>
  useLeavesMutation((input: LeaveApplyInput) => leavesApi.apply(input), 'Leave applied')

/** Approve / Reject on Leave Applications (also decides a cancellation). */
export function useDecideLeave() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: LeaveDecisionInput }) =>
      leavesApi.decide(id, input),
    meta: { suppressErrorToast: true },
    onSuccess: async () => {
      await queryClient.invalidateQueries()
    },
  })
}

/** Cancel on My Leaves: withdraws a pending application, or asks to cancel an approved one. */
export const useCancelLeave = () =>
  useLeavesMutation(
    ({ id, reason }: { id: string; reason: string }) => leavesApi.cancel(id, reason),
    'Cancellation recorded',
  )

export function useSaveLeaveSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: LeaveSettings) => leavesApi.saveSettings(input),
    meta: { successMessage: 'Settings saved', suppressErrorToast: true },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: leavesKeys.all })
    },
  })
}

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
export function useDeleteLeaveType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => leavesApi.deleteType(id),
    meta: { successMessage: 'Leave type deleted' },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: leavesKeys.all })
    },
  })
}

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

export function useDeleteLeavePolicy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => leavesApi.deletePolicy(id),
    meta: { successMessage: 'Policy deleted' },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: leavesKeys.all })
    },
  })
}

/** Enroll Employee on an employee-level policy: replaces who is enrolled. */
export function useEnrollEmployees() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, employeeIds }: { id: string; employeeIds: string[] }) =>
      leavesApi.enroll(id, employeeIds),
    meta: { successMessage: 'Enrollment saved', suppressErrorToast: true },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: leavesKeys.all })
    },
  })
}
