import { http, type HttpHandler, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  ENCASHMENT_TYPES,
  OVERTIME_POLICY_PERIODS,
  type OvertimePolicy,
  type OvertimeSettings,
} from '@/features/attendance'
import type { ApiItem, Paginated } from '@/types/api'

import { leaveTypeStore } from '../leaves/db'
import { approvedOvertimeSince } from '../requests/standard/kinds/overtime'
import {
  apiPath,
  createId,
  errorResponse,
  latency,
  paginate,
  readPageParams,
  requireAuth,
} from '../utils'
import {
  currentOvertimeSettings,
  nextOvertimeVersion,
  overtimePolicies,
  type OvertimePolicyRecord,
  overtimeSettingsStore,
  toPolicyOut,
} from './overtime-db'

export { resetAttendanceOvertimeDb } from './overtime-db'
/** For the rest of Attendance: a person's approved overtime of a day / month. */
export { approvedOvertimeInMonth, approvedOvertimeOn } from '../requests/standard/kinds/overtime'

/*
 * Attendance → Overtime settings on the API's routes:
 *   GET/PUT  /attendance/settings/overtime                  OvertimeSettings (+ rowVersion)
 *   GET/POST /attendance/settings/overtime-policies         ?q&period&page&pageSize
 *   GET/PUT/DELETE /attendance/settings/overtime-policies/:id  (DELETE ?rowVersion)
 * The overtime requests are a request type (`/requests/overtime`, src/mocks/requests/standard).
 */

const path = (suffix: string) => apiPath(`/attendance/settings${suffix}`)
const ok = <T>(data: T, status = 200) => HttpResponse.json<ApiItem<T>>({ data }, { status })
const invalid = (message: string, fieldErrors?: Record<string, string>) =>
  errorResponse(422, message, {
    code: 'VALIDATION_FAILED',
    ...(fieldErrors ? { fieldErrors } : {}),
  })
const stale = (what: string) =>
  errorResponse(409, `Someone else changed this ${what}. Reload it and try again`, {
    code: 'CONFLICT',
  })
const notFound = () => errorResponse(404, 'Overtime policy not found', { code: 'NOT_FOUND' })

async function readBody<T>(request: Request, schema: z.ZodType<T>) {
  const body: unknown = await request.json().catch(() => null)
  return schema.safeParse(body)
}

const guard = async (request: Request) => {
  await latency()
  return requireAuth(request)
}

// --- settings ----------------------------------------------------------------------------------

const settingsSchema = z.object({
  overtimeOnCheckIn: z.boolean().default(false),
  overtimeOnCheckOut: z.boolean().default(false),
  overtimeApprovalRequired: z.boolean().default(false),
  doNotAutoCreateRequests: z.boolean().default(false),
  overtimeOnHolidays: z.boolean().default(false),
  overtimeAfterDutyDuration: z.boolean().default(false),
  encashmentShiftMinutes: z.number().int().min(0).max(1440).default(0),
  rowVersion: z.string().nullish(),
})

const settingsOut = (): OvertimeSettings => {
  const { id: _id, ...settings } = currentOvertimeSettings()
  return settings
}

// --- policies ----------------------------------------------------------------------------------

const slabSchema = z.object({
  minMinutes: z.number().int().min(0),
  maxMinutes: z.number().int().min(0),
  encashmentType: z.enum(ENCASHMENT_TYPES),
  leaveTypeId: z.union([z.string(), z.number()]).transform(String).nullish(),
})

const policySchema = z.object({
  name: z.string().trim().min(1, 'Enter the policy name').max(200),
  period: z.enum(OVERTIME_POLICY_PERIODS),
  description: z.string().trim().max(4000).nullish(),
  isActive: z.boolean().default(true),
  slabs: z.array(slabSchema).max(100).default([]),
  rowVersion: z.string().nullish(),
})
type PolicyIn = z.infer<typeof policySchema>

/** A slab the wrong way round, a leave slab without its type, or two ranges that overlap. */
function slabProblem(slabs: PolicyIn['slabs']): string | null {
  for (const slab of slabs) {
    if (slab.maxMinutes <= slab.minMinutes) return 'A slab ends after it starts'
    if (slab.encashmentType === 'leave' && !slab.leaveTypeId) {
      return 'Choose the leave type of a leave slab'
    }
    if (slab.leaveTypeId && !leaveTypeStore.find(slab.leaveTypeId)) {
      return 'The leave type was not found'
    }
  }
  const sorted = [...slabs].sort((a, b) => a.minMinutes - b.minMinutes)
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]
    const current = sorted[index]
    if (previous && current && current.minMinutes <= previous.maxMinutes) {
      return `Slabs overlap: ${String(previous.minMinutes)}–${String(previous.maxMinutes)} and ${String(current.minMinutes)}–${String(current.maxMinutes)}`
    }
  }
  return null
}

const duplicateName = (name: string, exceptId?: string) =>
  overtimePolicies
    .all()
    .some((item) => item.id !== exceptId && item.name.toLowerCase() === name.toLowerCase())

const toSlabs = (slabs: PolicyIn['slabs']): OvertimePolicyRecord['slabs'] =>
  slabs.map((slab) => ({
    id: createId('ots'),
    minMinutes: slab.minMinutes,
    maxMinutes: slab.maxMinutes,
    encashmentType: slab.encashmentType,
    leaveTypeId: slab.encashmentType === 'leave' ? (slab.leaveTypeId ?? null) : null,
  }))

/**
 * Checks a policy body: the fields, the slabs and a name no other policy has. Returns the
 * fields to store or an error response.
 */
function checkPolicy(body: PolicyIn, exceptId?: string): Response | null {
  const problem = slabProblem(body.slabs)
  if (problem) return invalid(problem, { slabs: problem })
  if (duplicateName(body.name, exceptId)) {
    return errorResponse(409, `An overtime policy named "${body.name}" already exists`, {
      code: 'CONFLICT',
      fieldErrors: { name: 'Already exists' },
    })
  }
  return null
}

/** `fieldErrors` from a Zod failure, by the first path segment. */
const fieldErrorsOf = (error: z.ZodError) =>
  Object.fromEntries(error.issues.map((issue) => [String(issue.path[0] ?? 'body'), issue.message]))

/** Attendance → Overtime settings endpoints (overtime policies with slabs, overtime settings). */
export const attendanceOvertimeHandlers: HttpHandler[] = [
  http.get(path('/overtime'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    return ok(settingsOut())
  }),

  http.put(path('/overtime'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const parsed = await readBody(request, settingsSchema)
    if (!parsed.success) {
      return invalid('Some fields need your attention.', fieldErrorsOf(parsed.error))
    }
    const current = currentOvertimeSettings()
    if (parsed.data.rowVersion && parsed.data.rowVersion !== current.rowVersion) {
      return stale('setting')
    }
    const { rowVersion: _sent, ...values } = parsed.data
    const next = { ...current, ...values, rowVersion: nextOvertimeVersion() }
    if (!overtimeSettingsStore.update('settings', next)) overtimeSettingsStore.insert(next)
    return ok(settingsOut())
  }),

  http.get(path('/overtime-policies'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const period = OVERTIME_POLICY_PERIODS.find((item) => item === url.searchParams.get('period'))
    const rows = overtimePolicies
      .all()
      .filter(
        (item) =>
          (!period || item.period === period) && (!q || item.name.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toPolicyOut)
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json<Paginated<OvertimePolicy>>(paginate(rows, page, pageSize))
  }),

  http.get(path('/overtime-policies/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const record = overtimePolicies.find(String(params.id))
    return record ? ok(toPolicyOut(record)) : notFound()
  }),

  http.post(path('/overtime-policies'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const parsed = await readBody(request, policySchema)
    if (!parsed.success) {
      return invalid('Some fields need your attention.', fieldErrorsOf(parsed.error))
    }
    const refused = checkPolicy(parsed.data)
    if (refused) return refused
    const body = parsed.data
    const record: OvertimePolicyRecord = {
      id: createId('otp'),
      name: body.name,
      period: body.period,
      description: body.description ?? null,
      isActive: body.isActive,
      slabs: toSlabs(body.slabs),
      createdAt: new Date().toISOString(),
      updatedAt: null,
      rowVersion: nextOvertimeVersion(),
    }
    overtimePolicies.insert(record)
    return ok(toPolicyOut(record), 201)
  }),

  http.put(path('/overtime-policies/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const record = overtimePolicies.find(String(params.id))
    if (!record) return notFound()
    const parsed = await readBody(request, policySchema)
    if (!parsed.success) {
      return invalid('Some fields need your attention.', fieldErrorsOf(parsed.error))
    }
    if (parsed.data.rowVersion && parsed.data.rowVersion !== record.rowVersion) {
      return stale('policy')
    }
    const refused = checkPolicy(parsed.data, record.id)
    if (refused) return refused
    const body = parsed.data
    const next: OvertimePolicyRecord = {
      ...record,
      name: body.name,
      period: body.period,
      description: body.description ?? null,
      isActive: body.isActive,
      slabs: toSlabs(body.slabs),
      updatedAt: new Date().toISOString(),
      rowVersion: nextOvertimeVersion(),
    }
    overtimePolicies.update(record.id, next)
    return ok(toPolicyOut(next))
  }),

  /**
   * The mock refuses deleting an active policy that approved overtime fell under (approved
   * since it was created); it can be made inactive instead. The API's own rule is not known.
   */
  http.delete(path('/overtime-policies/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const record = overtimePolicies.find(String(params.id))
    if (!record) return notFound()
    const rowVersion = new URL(request.url).searchParams.get('rowVersion')
    if (rowVersion && rowVersion !== record.rowVersion) return stale('policy')
    const used = record.isActive ? approvedOvertimeSince(record.createdAt) : 0
    if (used > 0) {
      return errorResponse(
        409,
        `${String(used)} approved overtime request${used === 1 ? '' : 's'} fell under this policy. Make it inactive instead.`,
        { code: 'IN_USE' },
      )
    }
    overtimePolicies.remove(record.id)
    return new HttpResponse(null, { status: 204 })
  }),
]
