import { differenceInCalendarDays, parseISO } from 'date-fns'
import { http, type HttpHandler, HttpResponse } from 'msw'
import { z } from 'zod'

import type { LeaveRequestDetail, LeaveRequestStep } from '@/features/leaves/types/leaves.types'
import type { ApiItem } from '@/types/api'

import { apiPath, errorResponse, latency, requireAuth } from '../utils'
import { leaveRequests, leaveTypeStore } from './db'
import { balanceOf, coveredTypes, personOf, policyFor, requestDetailOut } from './rules'
import { MOCK_SELF_ID, nextRowVersion, type StoredLeaveRequest } from './seed'

/*
 * The leave kind of the requests API (`/api/requests/leave`, `/api/requests/approvals/{id}`),
 * answered over the Leaves mock's own requests. Not registered in `handlers.ts` (the requests
 * mock owns these paths); tests of the Leaves screens add them with `server.use(...)`, so
 * Apply, Cancel and Approve/Reject show up in the Leaves lists.
 */

const invalid = (field: string, message: string) =>
  errorResponse(422, message, { code: 'VALIDATION_FAILED', fieldErrors: { [field]: message } })

const conflict = () =>
  errorResponse(409, 'Someone else changed this request. Reload it and try again.', {
    code: 'CONFLICT',
  })

const id = z.union([z.string(), z.number()]).transform(String)

const applyIn = z.object({
  employeeId: id.nullable().optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(4000).nullable().optional(),
  attachments: z.array(id).max(20).default([]),
  details: z.object({
    leaveTypeId: id,
    isShort: z.boolean().default(false),
    shortLeaveType: z.enum(['half_day', 'quarter_day']).nullable().default(null),
    startTime: z.string().nullable().default(null),
    endTime: z.string().nullable().default(null),
  }),
})

const step = (
  request: StoredLeaveRequest,
  actionTaken: string,
  approverKind: string,
  remarks: string | null,
): LeaveRequestStep => {
  const now = new Date().toISOString()
  return {
    id: `st_${request.id}_${String(request.steps.length)}`,
    purpose: actionTaken.startsWith('cancel') ? 'cancel' : 'request',
    stepNo: approverKind === 'requester' ? null : 1,
    approverKind,
    approverId: approverKind === 'requester' ? null : MOCK_SELF_ID,
    approverName: approverKind === 'requester' ? null : 'Shelley Kannes',
    actedById: MOCK_SELF_ID,
    actedByName: 'Shelley Kannes',
    isDelegate: false,
    isConsent: false,
    actionTaken,
    remarks,
    actedAt: now,
    createdAt: now,
  }
}

const respond = (row: StoredLeaveRequest, status = 200) =>
  HttpResponse.json<ApiItem<LeaveRequestDetail>>({ data: requestDetailOut(row) }, { status })

export const leaveRequestHandlers: HttpHandler[] = [
  /**
   * `GET /requests/options/leave-types?employeeId=&asOf=`: the types the person's policy gives
   * (every active one without a policy), with the ledger balance of the year and the rules.
   */
  http.get(apiPath('/requests/options/leave-types'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const employeeId = url.searchParams.get('employeeId') ?? MOCK_SELF_ID
    if (!personOf(employeeId)) {
      return errorResponse(404, 'Employee not found.', { code: 'NOT_FOUND' })
    }
    const year = Number(
      (url.searchParams.get('asOf') ?? String(new Date().getFullYear())).slice(0, 4),
    )
    const policy = policyFor(employeeId, 'half_short')
    const rows = coveredTypes(employeeId).map(({ type }) => {
      const balance = balanceOf(employeeId, type.id, year)
      return {
        id: type.id,
        name: type.title,
        code: type.shortCode,
        isDeductible: type.isDeductible,
        isShortLeave: type.isShortLeave,
        allowHalfDay: type.isShortLeave && (policy?.allowHalfDay ?? true),
        allowShortLeave: type.isShortLeave && (policy?.allowShortLeave ?? true),
        attachmentRequired: type.attachmentRequired,
        attachmentRule: type.attachmentRule ?? 'refuse',
        allowBackDate: type.allowBackDate,
        backDateLimitDays: type.backDateLimitDays,
        futureLimitDays: type.hasFutureLimit ? type.futureLimitDays : null,
        ...balance,
      }
    })
    return HttpResponse.json({ data: rows })
  }),

  http.post(apiPath('/requests/leave'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const parsed = applyIn.safeParse(await request.json())
    if (!parsed.success) return invalid('body', parsed.error.issues[0]?.message ?? 'Invalid')
    const input = parsed.data
    const employeeId = input.employeeId ?? MOCK_SELF_ID
    if (!personOf(employeeId)) return invalid('employeeId', 'Employee not found.')
    const type = leaveTypeStore.find(input.details.leaveTypeId)
    if (!type?.isActive) return invalid('leaveTypeId', 'Leave type not found.')
    if (!coveredTypes(employeeId).some((item) => item.type.id === type.id)) {
      return invalid('leaveTypeId', 'No leave policy gives this employee this leave type.')
    }
    if (input.toDate < input.fromDate) return invalid('toDate', 'The end date is before the start.')
    const short = input.details.isShort
    if (short) {
      if (!type.isShortLeave)
        return invalid('isShort', 'This leave type cannot be taken as a short leave.')
      if (!input.details.startTime || !input.details.endTime) {
        return invalid('startTime', 'Start time and end time are required for a short leave.')
      }
      const policy = policyFor(employeeId, 'half_short')
      if (policy && input.details.shortLeaveType === 'half_day' && !policy.allowHalfDay) {
        return errorResponse(422, 'Half-day leave is not allowed for this employee.', {
          code: 'HALF_DAY_NOT_ALLOWED',
          fieldErrors: { shortLeaveType: 'Half-day leave is not allowed for this employee.' },
        })
      }
      if (policy && input.details.shortLeaveType === 'quarter_day' && !policy.allowShortLeave) {
        return errorResponse(422, 'Short leave is not allowed for this employee.', {
          code: 'SHORT_LEAVE_NOT_ALLOWED',
          fieldErrors: { shortLeaveType: 'Short leave is not allowed for this employee.' },
        })
      }
    }
    if (
      type.attachmentRequired &&
      type.attachmentRule !== 'note' &&
      input.attachments.length === 0
    ) {
      return invalid('attachment', 'This leave type needs an attachment.')
    }
    const days = short
      ? input.details.shortLeaveType === 'quarter_day'
        ? 0.25
        : 0.5
      : differenceInCalendarDays(parseISO(input.toDate), parseISO(input.fromDate)) + 1
    if (type.isDeductible) {
      const balance = balanceOf(employeeId, type.id, Number(input.fromDate.slice(0, 4)))
      if (days > balance.available) {
        return invalid(
          'leaveTypeId',
          `Only ${String(balance.available)} days of ${type.title} are available.`,
        )
      }
    }
    const number = leaveRequests.all().length + 1
    const now = new Date().toISOString()
    const row: StoredLeaveRequest = {
      id: `lv_new_${String(number)}`,
      code: `RQ-LV-${String(number).padStart(4, '0')}`,
      status: 'pending',
      employeeId,
      leaveTypeId: type.id,
      fromDate: input.fromDate,
      toDate: input.toDate,
      days,
      isShort: short,
      shortLeaveType: short ? input.details.shortLeaveType : null,
      startTime: short ? input.details.startTime : null,
      endTime: short ? input.details.endTime : null,
      reason: input.reason ?? null,
      submittedAt: now,
      decidedAt: null,
      cancelReason: null,
      createdAt: now,
      rowVersion: nextRowVersion(),
      steps: [],
      attachments: input.attachments.map((fileId, index) => ({
        id: `at_${String(number)}_${String(index)}`,
        fileId,
        name: `Attachment ${String(index + 1)}`,
        url: apiPath(`/files/${fileId}/download?token=mock`),
        createdAt: now,
      })),
    }
    row.steps = [step(row, 'submitted', 'requester', null)]
    leaveRequests.insert(row)
    return respond(row, 201)
  }),

  http.get(apiPath('/requests/leave/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const row = leaveRequests.find(String(params.id))
    if (!row) return errorResponse(404, 'Request not found', { code: 'NOT_FOUND' })
    return respond(row)
  }),

  http.post(apiPath('/requests/leave/:id/cancel'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const row = leaveRequests.find(String(params.id))
    if (!row) return errorResponse(404, 'Request not found', { code: 'NOT_FOUND' })
    const parsed = z
      .object({ reason: z.string().trim().min(1), rowVersion: z.string() })
      .safeParse(await request.json())
    if (!parsed.success) return invalid('reason', 'Give the reason for cancellation.')
    if (parsed.data.rowVersion !== row.rowVersion) return conflict()
    if (row.status !== 'pending' && row.status !== 'approved') {
      return errorResponse(409, 'This request can no longer be cancelled.', {
        code: 'INVALID_STATE',
      })
    }
    const next: StoredLeaveRequest = {
      ...row,
      status: row.status === 'pending' ? 'cancelled' : 'cancelling',
      cancelReason: parsed.data.reason,
      decidedAt: row.status === 'pending' ? new Date().toISOString() : row.decidedAt,
      rowVersion: nextRowVersion(),
    }
    next.steps = [...row.steps, step(row, 'cancelled', 'requester', parsed.data.reason)]
    leaveRequests.update(row.id, next)
    return respond(next)
  }),

  http.post(apiPath('/requests/approvals/:id/:decision'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const decision = String(params.decision)
    if (decision !== 'approve' && decision !== 'reject') return undefined
    const row = leaveRequests.find(String(params.id))
    if (!row) return undefined
    const parsed = z
      .object({ remarks: z.string().nullable().optional(), rowVersion: z.string() })
      .safeParse(await request.json())
    if (!parsed.success) return invalid('rowVersion', 'Reload the request and try again.')
    if (parsed.data.rowVersion !== row.rowVersion) return conflict()
    if (row.status !== 'pending' && row.status !== 'cancelling') {
      return errorResponse(409, 'This request is not waiting for a decision.', {
        code: 'INVALID_STATE',
      })
    }
    if (decision === 'reject' && !parsed.data.remarks?.trim()) {
      return invalid('remarks', 'Give a reason for rejecting.')
    }
    const status: StoredLeaveRequest['status'] =
      row.status === 'cancelling'
        ? decision === 'approve'
          ? 'cancelled'
          : 'approved'
        : decision === 'approve'
          ? 'approved'
          : 'rejected'
    const next: StoredLeaveRequest = {
      ...row,
      status,
      decidedAt: new Date().toISOString(),
      rowVersion: nextRowVersion(),
    }
    next.steps = [
      ...row.steps,
      step(
        row,
        decision === 'approve' ? 'approved' : 'rejected',
        'line_manager',
        parsed.data.remarks ?? null,
      ),
    ]
    leaveRequests.update(row.id, next)
    return respond(next)
  }),
]
