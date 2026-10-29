import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { attendanceKeys } from '../api/attendance.api'
import {
  overtimeApi,
  overtimeApprovalsQueryOptions,
  overtimeDetailQueryOptions,
  overtimeKeys,
  overtimeLeaveTypesQueryOptions,
  overtimeListQueryOptions,
  overtimePoliciesQueryOptions,
  overtimeSettingsQueryOptions,
} from '../api/overtime.api'
import type {
  OvertimeApprovalParams,
  OvertimeDecisionInput,
  OvertimeListParams,
  OvertimePolicyInput,
  OvertimePolicyParams,
  OvertimeRequestBody,
  OvertimeSettings,
} from '../types/overtime.types'

/** One page of overtime requests (`GET /requests/overtime`): yours, your team's or everyone's. */
export const useOvertimeRequests = (params: OvertimeListParams, enabled = true) =>
  useQuery({ ...overtimeListQueryOptions(params), enabled })

/** One page of the overtime that reached you for approval (`GET /requests/approvals`). */
export const useOvertimeApprovals = (params: OvertimeApprovalParams) =>
  useQuery(overtimeApprovalsQueryOptions(params))

/** A request with its steps and the caller's actions (as requester, or as approver). */
export const useOvertimeDetail = (
  id: string,
  via: 'request' | 'approvals' = 'request',
  enabled = true,
) => useQuery({ ...overtimeDetailQueryOptions(id, via), enabled })

export const useOvertimePolicies = (params: OvertimePolicyParams) =>
  useQuery(overtimePoliciesQueryOptions(params))

/** Every policy (the approve popup and the sheet cap the minutes by the active daily one). */
export const useAllOvertimePolicies = (enabled = true) =>
  useQuery({ ...overtimePoliciesQueryOptions({ page: 1, pageSize: 100 }), enabled })

/** Leave types a slab can encash into. */
export const useOvertimeLeaveTypes = (enabled = true) =>
  useQuery({ ...overtimeLeaveTypesQueryOptions(), enabled })

export const useOvertimeSettings = () => useQuery(overtimeSettingsQueryOptions())

/**
 * An Overtime write: toasts its own success, leaves the error to the form (inline), and
 * refetches Overtime, the Requests module's lists and the time sheets (approved minutes land
 * on the person's day).
 */
function useOvertimeMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  successMessage: string | ((result: TResult, variables: TVariables) => string | null),
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    meta: {
      ...(typeof successMessage === 'string' ? { successMessage } : {}),
      suppressErrorToast: true,
    },
    onSuccess: async (result, variables) => {
      if (typeof successMessage === 'function') {
        const message = successMessage(result, variables)
        if (message) toast.success(message)
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: overtimeKeys.all }),
        queryClient.invalidateQueries({ queryKey: attendanceKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['requests'] }),
      ])
    },
  })
}

/** "+ Apply Overtime" → Apply: `POST /requests/overtime`. */
export const useApplyOvertime = () =>
  useOvertimeMutation((body: OvertimeRequestBody) => overtimeApi.create(body), 'Overtime applied')

/**
 * Edit on My Overtime: `PUT /requests/overtime/{id}` (allowed while nobody has acted; it leaves
 * the files alone), then the images taken off and the new ones added.
 */
export const useUpdateOvertime = () =>
  useOvertimeMutation(
    async ({
      id,
      body,
      addFileIds,
      removeAttachmentIds,
    }: {
      id: string
      body: OvertimeRequestBody
      addFileIds: readonly string[]
      removeAttachmentIds: readonly string[]
    }) => {
      const saved = await overtimeApi.update(id, body)
      for (const attachmentId of removeAttachmentIds) {
        await overtimeApi.removeAttachment(id, attachmentId)
      }
      for (const fileId of addFileIds) await overtimeApi.addAttachment(id, fileId)
      return saved
    },
    'Overtime request updated',
  )

/** Delete on My Overtime: a pending request nobody has acted on. */
export const useDeleteOvertime = () =>
  useOvertimeMutation(
    ({ id, rowVersion }: { id: string; rowVersion: string }) => overtimeApi.remove(id, rowVersion),
    'Overtime request deleted',
  )

/** View → Add Images, or × on one: the files of a request already filed. */
export const useOvertimeAttachment = () =>
  useOvertimeMutation(
    (change: { id: string; addFileId: string } | { id: string; removeId: string }) =>
      'addFileId' in change
        ? overtimeApi.addAttachment(change.id, change.addFileId)
        : overtimeApi.removeAttachment(change.id, change.removeId),
    (_result, change) => ('addFileId' in change ? 'Image added' : 'Image removed'),
  )

/** Consents box → Agree / Disagree. */
export const useConsentOvertime = () =>
  useOvertimeMutation(
    ({
      id,
      agree,
      remarks,
      rowVersion,
    }: {
      id: string
      agree: boolean
      remarks: string | null
      rowVersion: string
    }) => overtimeApi.consent(id, agree, remarks, rowVersion),
    (result, { agree }) =>
      agree
        ? `You agreed to ${result.employeeName}'s overtime`
        : `Your disagreement with ${result.employeeName}'s overtime is recorded`,
  )

/** Forward: the step waiting for you goes to another employee. */
export const useForwardOvertime = () =>
  useOvertimeMutation(
    ({
      id,
      employeeId,
      remarks,
      rowVersion,
    }: {
      id: string
      employeeId: string
      remarks: string | null
      rowVersion: string
    }) => overtimeApi.forward(id, employeeId, remarks, rowVersion),
    (result) => `Forwarded to ${result.nextApproverName ?? 'the chosen employee'}`,
  )

/** Applications → Reject Selected: one reason for every ticked request. */
export const useBulkRejectOvertime = () =>
  useOvertimeMutation(
    ({
      items,
      remarks,
    }: {
      items: readonly { id: string; rowVersion: string }[]
      remarks: string
    }) => overtimeApi.bulkReject(items, remarks),
    (results) => {
      const done = results.filter((result) => result.ok).length
      const failed = results.length - done
      if (done === 0) return null
      return `Rejected ${String(done)} request${done === 1 ? '' : 's'}${failed > 0 ? `; ${String(failed)} could not be` : ''}`
    },
  )

/** Withdraw a pending request, or ask to cancel an approved one. */
export const useCancelOvertime = () =>
  useOvertimeMutation(
    ({ id, reason, rowVersion }: { id: string; reason: string; rowVersion: string }) =>
      overtimeApi.cancel(id, reason, rowVersion),
    (result) =>
      result.status === 'cancelling' ? 'Cancellation requested' : 'Overtime request withdrawn',
  )

/** Approve or reject on Applications. */
export const useDecideOvertime = () =>
  useOvertimeMutation(
    ({
      id,
      decision,
      input,
    }: {
      id: string
      decision: 'approve' | 'reject'
      input: OvertimeDecisionInput
    }) => overtimeApi.decide(id, decision, input),
    (result, { decision }) =>
      decision === 'reject'
        ? `Rejected ${result.employeeName}'s overtime`
        : result.status === 'cancelled'
          ? `Cancelled ${result.employeeName}'s overtime`
          : result.status === 'approved'
            ? `Approved ${String(result.approvedMinutes ?? result.appliedMinutes)} minutes for ${result.employeeName}`
            : `Approved; ${result.employeeName}'s overtime goes on to ${result.nextApproverName ?? 'the next approver'}`,
  )

/**
 * Writes the bulk sheet, row by row (no toast: the caller reports). Kept as a plain function
 * so one Bulk Save can run several calls and collect what went through.
 */
export function useOvertimeBatch() {
  const queryClient = useQueryClient()
  return async <T>(run: () => Promise<T>): Promise<T> => {
    try {
      return await run()
    } finally {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: overtimeKeys.all }),
        queryClient.invalidateQueries({ queryKey: attendanceKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['requests'] }),
      ])
    }
  }
}

/** "Overtime Policy Create" → Save, and Edit. */
export const useSaveOvertimePolicy = () =>
  useOvertimeMutation(
    ({ id, input }: { id?: string | undefined; input: OvertimePolicyInput }) =>
      id ? overtimeApi.updatePolicy(id, input) : overtimeApi.createPolicy(input),
    (_result, { id }) => (id ? 'Overtime policy updated' : 'Overtime policy created'),
  )

export const useDeleteOvertimePolicy = () =>
  useOvertimeMutation(
    ({ id, rowVersion }: { id: string; rowVersion: string }) =>
      overtimeApi.deletePolicy(id, rowVersion),
    'Overtime policy deleted',
  )

/** Settings → Save Changes. */
export const useSaveOvertimeSettings = () =>
  useOvertimeMutation(
    (input: OvertimeSettings) => overtimeApi.saveSettings(input),
    'Overtime settings saved',
  )
