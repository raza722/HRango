import { http, type HttpHandler, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  APPROVE_ON_STATUSES,
  ATTACHMENT_RULES,
  BALANCE_BASES,
  type EnrolledEmployee,
  FINAL_APPROVAL_AUTHORITIES,
  LEAVE_GENDER_RULES,
  LEAVE_MARITAL_RULES,
  LEAVE_TENURES,
  type LeavePolicy,
  type LeaveSettings,
  type LeaveType,
  POLICY_KINDS,
  POLICY_LEVELS,
  SHORT_SLAB_VALUE_TYPES,
} from '@/features/leaves/types/leaves.types'
import type { ApiItem, Paginated } from '@/types/api'

import {
  apiPath,
  createId,
  errorResponse,
  latency,
  paginate,
  readPageParams,
  requireAuth,
} from '../utils'
import { currentLeaveSettings, leavePolicies, leaveSettingsStore, leaveTypeStore } from './db'
import { inUseCount, personOf, policyOut, typeOut } from './rules'
import { nextRowVersion, type StoredLeavePolicy, type StoredLeaveType } from './seed'

/*
 * Settings → General Settings, Leave Types and Leave Policies with enrolment
 * (`/api/leaves/settings`, `/types`, `/policies`), as backend/app/routers/leaves.py answers.
 */

const invalid = (
  fieldErrors: Record<string, string>,
  message = 'Some fields need your attention.',
) => errorResponse(422, message, { code: 'VALIDATION_FAILED', fieldErrors })

const conflict = () =>
  errorResponse(409, 'Someone else changed this record. Reload it and try again.', {
    code: 'CONFLICT',
  })

/** A 409 with the field it is about, as the procedures THROW them. */
const refuse = (code: string, field: string, message: string) =>
  errorResponse(409, message, { code, fieldErrors: { [field]: message } })

const notFound = (what: string) => errorResponse(404, `${what} not found.`, { code: 'NOT_FOUND' })

/** Turns a Zod failure into the backend's `fieldErrors` (first message per top-level field). */
function zodErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'body')
    out[key] ??= issue.message
  }
  return out
}

const days = z.number().min(0).max(366)
const id = z.union([z.string(), z.number()]).transform(String)

const settingsIn = z.object({
  finalApprovalBy: z.enum(FINAL_APPROVAL_AUTHORITIES),
  approveOnStatus: z.enum(APPROVE_ON_STATUSES),
  postDeadline: z.boolean().default(false),
  rowVersion: z.string().nullable().optional(),
})

const typeIn = z.object({
  title: z.string().trim().min(1).max(200),
  shortCode: z.string().trim().min(1).max(10),
  allowance: days,
  isActive: z.boolean().default(true),
  isProbationType: z.boolean().default(false),
  autoAllotment: z.boolean().default(false),
  autoBalanceOnJoining: z.boolean().default(false),
  isComposite: z.boolean().default(false),
  isShortLeave: z.boolean().default(false),
  showInPayslip: z.boolean().default(false),
  isDeductible: z.boolean().default(true),
  isSandwich: z.boolean().default(false),
  sandwichAcrossTypes: z.boolean().default(false),
  isEarned: z.boolean().default(false),
  allowBackDate: z.boolean().default(false),
  backDateLimitDays: z.number().int().min(0).max(366).nullable().default(null),
  hasFutureLimit: z.boolean().default(false),
  futureLimitDays: z.number().int().min(0).max(366).nullable().default(null),
  attachmentRequired: z.boolean().default(false),
  attachmentRule: z.enum(ATTACHMENT_RULES).nullable().default(null),
  allowEncashment: z.boolean().default(false),
  encashmentMin: days.nullable().default(null),
  encashmentMax: days.nullable().default(null),
  carryForward: z.boolean().default(false),
  proRated: z.boolean().default(false),
  gender: z.enum(LEAVE_GENDER_RULES).default('any'),
  maritalStatus: z.enum(LEAVE_MARITAL_RULES).default('any'),
  allowedInProbation: z.boolean().default(false),
  minExperienceMonths: z.number().int().min(0).max(600).nullable().default(null),
  maxApplications: z.number().int().min(1).max(1000).nullable().default(null),
  gapBetweenApplicationsMonths: z.number().int().min(0).max(600).nullable().default(null),
  tenure: z.enum(LEAVE_TENURES).default('yearly'),
  balanceBasis: z.enum(BALANCE_BASES).default('flat'),
  accumulativeCount: z.number().int().min(1).max(50).nullable().default(null),
  experienceSlabs: z
    .array(
      z.object({
        minMonths: z.number().int().min(0),
        maxMonths: z.number().int().min(0).nullable().default(null),
        balance: days,
      }),
    )
    .max(50)
    .default([]),
  shortSlabs: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        balance: days.nullable().default(null),
        valueType: z.enum(SHORT_SLAB_VALUE_TYPES),
        value: z.number().min(0).nullable().default(null),
      }),
    )
    .max(20)
    .default([]),
  rowVersion: z.string().nullable().optional(),
})

const policyIn = z.object({
  title: z.string().trim().min(1).max(200),
  policyKind: z.enum(POLICY_KINDS),
  policyLevel: z.enum(POLICY_LEVELS),
  allowHalfDay: z.boolean().default(false),
  allowShortLeave: z.boolean().default(false),
  isActive: z.boolean().default(true),
  types: z
    .array(z.object({ leaveTypeId: id, allowance: days.nullable().default(null) }))
    .max(100)
    .default([]),
  rowVersion: z.string().nullable().optional(),
})

/** The checks the procedures make: unique title and code, slabs that do not overlap. */
function checkType(input: z.infer<typeof typeIn>, ownId: string | null) {
  const others = leaveTypeStore.all().filter((type) => type.id !== ownId)
  if (others.some((type) => type.title.toLowerCase() === input.title.toLowerCase())) {
    return refuse('LEAVE_TYPE_DUPLICATE', 'title', 'A leave type with this title already exists.')
  }
  if (others.some((type) => type.shortCode.toLowerCase() === input.shortCode.toLowerCase())) {
    return refuse(
      'LEAVE_TYPE_DUPLICATE',
      'shortCode',
      'A leave type with this short code already exists.',
    )
  }
  const slabs = [...input.experienceSlabs].sort((a, b) => a.minMonths - b.minMonths)
  for (let index = 1; index < slabs.length; index += 1) {
    const previous = slabs[index - 1]
    const slab = slabs[index]
    if (previous && slab && (previous.maxMonths === null || previous.maxMonths >= slab.minMonths)) {
      return invalid({ experienceSlabs: 'Experience slabs overlap.' })
    }
  }
  return null
}

function checkPolicy(input: z.infer<typeof policyIn>, ownId: string | null) {
  const others = leavePolicies.all().filter((policy) => policy.id !== ownId)
  if (input.policyKind === 'distribution' && input.types.length === 0) {
    return invalid({ types: 'Choose at least one leave type.' })
  }
  if (others.some((policy) => policy.title.toLowerCase() === input.title.toLowerCase())) {
    return refuse(
      'LEAVE_POLICY_DUPLICATE',
      'title',
      'A leave policy with this title already exists.',
    )
  }
  if (input.types.some((row) => !leaveTypeStore.find(row.leaveTypeId))) {
    return invalid({ types: 'Leave type not found.' }, 'Leave type not found.')
  }
  if (
    input.isActive &&
    input.policyLevel === 'company' &&
    others.some(
      (policy) =>
        policy.isActive &&
        policy.policyLevel === 'company' &&
        policy.policyKind === input.policyKind,
    )
  ) {
    return refuse(
      'LEAVE_POLICY_COMPANY_EXISTS',
      'policyLevel',
      'Another active company-level policy of this kind exists. Make it inactive first.',
    )
  }
  return null
}

const typePath = apiPath('/leaves/types/:id')
const policyPath = apiPath('/leaves/policies/:id')

export const leaveSettingsHandlers: HttpHandler[] = [
  // --- General settings ---------------------------------------------------------------------------
  http.get(apiPath('/leaves/settings'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const { id: _id, ...settings } = currentLeaveSettings()
    return HttpResponse.json<ApiItem<LeaveSettings>>({ data: settings })
  }),

  http.put(apiPath('/leaves/settings'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const parsed = settingsIn.safeParse(await request.json())
    if (!parsed.success) return invalid(zodErrors(parsed.error))
    const current = currentLeaveSettings()
    if (
      current.rowVersion &&
      parsed.data.rowVersion &&
      parsed.data.rowVersion !== current.rowVersion
    ) {
      return conflict()
    }
    const next = {
      id: 'settings' as const,
      finalApprovalBy: parsed.data.finalApprovalBy,
      approveOnStatus: parsed.data.approveOnStatus,
      postDeadline: parsed.data.postDeadline,
      rowVersion: nextRowVersion(),
    }
    if (!leaveSettingsStore.update('settings', next)) leaveSettingsStore.insert(next)
    const { id: _id, ...settings } = next
    return HttpResponse.json<ApiItem<LeaveSettings>>({ data: settings })
  }),

  // --- Leave types ----------------------------------------------------------------------------------
  http.get(apiPath('/leaves/types'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const { page, pageSize } = readPageParams(url)
    const q = url.searchParams.get('q')?.trim().toLowerCase()
    const isActive = url.searchParams.get('isActive')
    const rows = leaveTypeStore
      .all()
      .filter((type) => !q || `${type.title} ${type.shortCode}`.toLowerCase().includes(q))
      .filter((type) => isActive === null || String(type.isActive) === isActive)
      .sort((a, b) => a.title.localeCompare(b.title))
      .map(typeOut)
    return HttpResponse.json<Paginated<LeaveType>>(paginate(rows, page, pageSize))
  }),

  http.get(typePath, async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const type = leaveTypeStore.find(String(params.id))
    if (!type) return notFound('Leave type')
    return HttpResponse.json<ApiItem<LeaveType>>({ data: typeOut(type) })
  }),

  http.post(apiPath('/leaves/types'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const parsed = typeIn.safeParse(await request.json())
    if (!parsed.success) return invalid(zodErrors(parsed.error))
    const refused = checkType(parsed.data, null)
    if (refused) return refused
    const { rowVersion: _rowVersion, ...input } = parsed.data
    const stored: StoredLeaveType = {
      ...input,
      id: createId('lt'),
      createdAt: new Date().toISOString(),
      updatedAt: null,
      rowVersion: nextRowVersion(),
    }
    leaveTypeStore.insert(stored)
    return HttpResponse.json<ApiItem<LeaveType>>({ data: typeOut(stored) }, { status: 201 })
  }),

  http.put(typePath, async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const current = leaveTypeStore.find(String(params.id))
    if (!current) return notFound('Leave type')
    const parsed = typeIn.safeParse(await request.json())
    if (!parsed.success) return invalid(zodErrors(parsed.error))
    if (parsed.data.rowVersion && parsed.data.rowVersion !== current.rowVersion) return conflict()
    const refused = checkType(parsed.data, current.id)
    if (refused) return refused
    const { rowVersion: _rowVersion, ...input } = parsed.data
    const next: StoredLeaveType = {
      ...current,
      ...input,
      updatedAt: new Date().toISOString(),
      rowVersion: nextRowVersion(),
    }
    leaveTypeStore.update(current.id, next)
    return HttpResponse.json<ApiItem<LeaveType>>({ data: typeOut(next) })
  }),

  http.delete(typePath, async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const current = leaveTypeStore.find(String(params.id))
    if (!current) return notFound('Leave type')
    const rowVersion = new URL(request.url).searchParams.get('rowVersion')
    if (rowVersion && rowVersion !== current.rowVersion) return conflict()
    if (inUseCount(current.id) > 0) {
      return errorResponse(
        409,
        'This leave type has balances or leave requests. Make it inactive instead',
        { code: 'CONFLICT' },
      )
    }
    leaveTypeStore.remove(current.id)
    return new HttpResponse(null, { status: 204 })
  }),

  // --- Leave policies -----------------------------------------------------------------------------
  http.get(apiPath('/leaves/policies'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const { page, pageSize } = readPageParams(url)
    const q = url.searchParams.get('q')?.trim().toLowerCase()
    const kind = url.searchParams.get('kind')
    const rows = leavePolicies
      .all()
      .filter((policy) => !q || policy.title.toLowerCase().includes(q))
      .filter((policy) => !kind || policy.policyKind === kind)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(policyOut)
    return HttpResponse.json<Paginated<LeavePolicy>>(paginate(rows, page, pageSize))
  }),

  http.get(policyPath, async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const policy = leavePolicies.find(String(params.id))
    if (!policy) return notFound('Leave policy')
    return HttpResponse.json<ApiItem<LeavePolicy>>({ data: policyOut(policy) })
  }),

  http.post(apiPath('/leaves/policies'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const parsed = policyIn.safeParse(await request.json())
    if (!parsed.success) return invalid(zodErrors(parsed.error))
    const refused = checkPolicy(parsed.data, null)
    if (refused) return refused
    const { rowVersion: _rowVersion, ...input } = parsed.data
    const stored: StoredLeavePolicy = {
      ...input,
      types: input.policyKind === 'distribution' ? input.types : [],
      enrolled: [],
      id: createId('lp'),
      createdAt: new Date().toISOString(),
      updatedAt: null,
      rowVersion: nextRowVersion(),
    }
    leavePolicies.insert(stored)
    return HttpResponse.json<ApiItem<LeavePolicy>>({ data: policyOut(stored) }, { status: 201 })
  }),

  http.put(policyPath, async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const current = leavePolicies.find(String(params.id))
    if (!current) return notFound('Leave policy')
    const parsed = policyIn.safeParse(await request.json())
    if (!parsed.success) return invalid(zodErrors(parsed.error))
    if (parsed.data.rowVersion && parsed.data.rowVersion !== current.rowVersion) return conflict()
    const refused = checkPolicy(parsed.data, current.id)
    if (refused) return refused
    const { rowVersion: _rowVersion, ...input } = parsed.data
    const next: StoredLeavePolicy = {
      ...current,
      ...input,
      types: input.policyKind === 'distribution' ? input.types : [],
      enrolled: input.policyLevel === 'employee' ? current.enrolled : [],
      updatedAt: new Date().toISOString(),
      rowVersion: nextRowVersion(),
    }
    leavePolicies.update(current.id, next)
    return HttpResponse.json<ApiItem<LeavePolicy>>({ data: policyOut(next) })
  }),

  http.delete(policyPath, async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const current = leavePolicies.find(String(params.id))
    if (!current) return notFound('Leave policy')
    const rowVersion = new URL(request.url).searchParams.get('rowVersion')
    if (rowVersion && rowVersion !== current.rowVersion) return conflict()
    leavePolicies.remove(current.id)
    return new HttpResponse(null, { status: 204 })
  }),

  // --- Enrolment ----------------------------------------------------------------------------------
  http.get(apiPath('/leaves/policies/:id/employees'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const policy = leavePolicies.find(String(params.id))
    if (!policy) return notFound('Leave policy')
    const { page, pageSize } = readPageParams(new URL(request.url))
    const rows: EnrolledEmployee[] = policy.enrolled.flatMap((row) => {
      const person = personOf(row.employeeId)
      return person
        ? [
            {
              employeeId: person.id,
              employeeCode: person.code,
              employeeName: person.name,
              departmentName: person.departmentName,
              enrolledAt: row.enrolledAt,
            },
          ]
        : []
    })
    return HttpResponse.json<Paginated<EnrolledEmployee>>(paginate(rows, page, pageSize))
  }),

  http.post(apiPath('/leaves/policies/:id/employees'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const policy = leavePolicies.find(String(params.id))
    if (!policy) return notFound('Leave policy')
    const parsed = z
      .object({ employeeIds: z.array(id).min(1).max(1000) })
      .safeParse(await request.json())
    if (!parsed.success) return invalid(zodErrors(parsed.error))
    if (policy.policyLevel !== 'employee') {
      return invalid(
        { employeeIds: 'A company-level policy covers everyone; nobody needs enrolling.' },
        'A company-level policy covers everyone; nobody needs enrolling.',
      )
    }
    if (parsed.data.employeeIds.some((employeeId) => !personOf(employeeId))) {
      return invalid({ employeeIds: 'Employee not found.' })
    }
    // A person is in at most one active employee-level policy of a kind.
    const taken = leavePolicies
      .all()
      .some(
        (other) =>
          other.id !== policy.id &&
          other.isActive &&
          other.policyKind === policy.policyKind &&
          other.enrolled.some((row) => parsed.data.employeeIds.includes(row.employeeId)),
      )
    if (taken) {
      return refuse(
        'LEAVE_POLICY_ALREADY_ENROLLED',
        'employeeIds',
        'Someone chosen is already enrolled in another active policy of this kind.',
      )
    }
    const now = new Date().toISOString()
    const added = parsed.data.employeeIds
      .filter((employeeId) => !policy.enrolled.some((row) => row.employeeId === employeeId))
      .map((employeeId) => ({ employeeId, enrolledAt: now }))
    const next = {
      ...policy,
      enrolled: [...policy.enrolled, ...added],
      rowVersion: nextRowVersion(),
    }
    leavePolicies.update(policy.id, next)
    return HttpResponse.json<ApiItem<LeavePolicy>>({ data: policyOut(next) })
  }),

  http.delete(
    apiPath('/leaves/policies/:id/employees/:employeeId'),
    async ({ request, params }) => {
      await latency()
      const denied = requireAuth(request)
      if (denied) return denied
      const policy = leavePolicies.find(String(params.id))
      if (!policy) return notFound('Leave policy')
      leavePolicies.update(policy.id, {
        ...policy,
        enrolled: policy.enrolled.filter((row) => row.employeeId !== String(params.employeeId)),
        rowVersion: nextRowVersion(),
      })
      return new HttpResponse(null, { status: 204 })
    },
  ),
]
