import { format } from 'date-fns'
import { z } from 'zod'

import {
  type FlowStep,
  REQUEST_STATUSES,
  type RequestCounts,
  type RequestStatus,
} from '@/features/requests'

import { apiPath, errorResponse } from '../utils'
import type { StoredStep } from './flow'
import { ref } from './people'

/** Helpers every request kind's handlers share (Punch, Shift, Transfer). */
export const base = (path: string) => apiPath(`/requests${path}`)
export const invalid = (message: string, fieldErrors?: Record<string, string>) =>
  errorResponse(422, message, {
    code: 'VALIDATION_FAILED',
    ...(fieldErrors ? { fieldErrors } : {}),
  })
export const forbidden = (message: string) => errorResponse(403, message, { code: 'FORBIDDEN' })
export const notFound = () =>
  errorResponse(404, 'That request could not be found.', { code: 'NOT_FOUND' })
export const today = () => format(new Date(), 'yyyy-MM-dd')
export const now = () => new Date().toISOString()

export async function readBody<T>(request: Request, schema: z.ZodType<T>) {
  const body: unknown = await request.json().catch(() => null)
  return schema.safeParse(body)
}

export const text = z.string().trim().max(500)

export function toStep(step: StoredStep): FlowStep {
  return {
    authority: step.authority,
    approver: ref(step.approverId),
    status: step.status,
    actedBy: step.actedById ? ref(step.actedById) : null,
    actedAt: step.actedAt,
    remarks: step.remarks,
  }
}

/** The status tabs' counts ("All (8)", "Pending (2)" …). */
export function countsOf(records: readonly { status: RequestStatus }[]): RequestCounts {
  const counts = Object.fromEntries(REQUEST_STATUSES.map((status) => [status, 0])) as RequestCounts
  counts.all = records.length
  for (const record of records) counts[record.status] += 1
  return counts
}
