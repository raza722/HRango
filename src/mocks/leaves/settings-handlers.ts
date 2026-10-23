import { http, type HttpHandler, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  APPROVE_ON_STATUSES,
  ATTACHMENT_RULES,
  BALANCE_BASES,
  FINAL_APPROVAL_AUTHORITIES,
  LEAVE_GENDER_RULES,
  LEAVE_MARITAL_RULES,
  LEAVE_TENURES,
  type LeavePolicy,
  type LeaveSettings,
  type LeaveType,
  POLICY_KINDS,
  POLICY_LEVELS,
  SHORT_SLAB_UNITS,
} from '@/features/leaves'
import type { ApiItem, Paginated } from '@/types/api'

import { DIRECTORY, findEmployee } from '../employees/seed'
import { invalid, notFound, readBody } from '../requests/http'
import { ref } from '../requests/people'
import { standardRequests } from '../requests/standard'
import {
  apiPath,
  createId,
  errorResponse,
  latency,
  paginate,
  readPageParams,
  requireAuth,
} from '../utils'
import { leavePolicies, leaveSettingsStore, leaveTypes, publicLeaveSettings } from './db'
import { isLeave, leaveStored } from './rules'
import type { StoredLeavePolicy, StoredLeaveType } from './seed'

/*
 * Settings → General Settings, Leave Types and Leave Policies:
 *   GET/PUT  /leaves/settings
 *   GET/POST /leaves/types            PUT/DELETE /leaves/types/:id
 *   GET/POST /leaves/policies         PUT/DELETE /leaves/policies/:id
 *   PUT      /leaves/policies/:id/enrollments   { employeeIds }
 */

const path = (suffix = '') => apiPath(`/leaves${suffix}`)
const conflict = (message: string, fieldErrors?: Record<string, string>) =>
  errorResponse(409, message, { code: 'CONFLICT', ...(fieldErrors ? { fieldErrors } : {}) })

const guard = async (request: Request) => {
  await latency()
  return requireAuth(request)
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

// --- General Settings -----------------------------------------------------------------------------

const settingsSchema = z.object({
  finalApprovalBy: z.enum(FINAL_APPROVAL_AUTHORITIES),
  approveOnStatus: z.enum(APPROVE_ON_STATUSES),
  postDeadline: z.boolean(),
})

// --- Leave Types ----------------------------------------------------------------------------------

const whole = (max: number) => z.number().int().min(0).max(max)
const daysNumber = z.number().min(0).max(365)

const typeSchema = z.object({
  title: z.string().trim().min(1).max(60),
  shortCode: z.string().trim().min(1).max(10),
  leavesAllowed: daysNumber,
  probationType: z.boolean(),
  active: z.boolean(),
  autoAllotment: z.boolean(),
  autoBalanceOnJoiningMonth: z.boolean(),
  composite: z.boolean(),
  shortLeave: z.boolean(),
  showInPayslip: z.boolean(),
  deductible: z.boolean(),
  sandwich: z.boolean(),
  sandwichAcrossTypes: z.boolean(),
  earnedBalance: z.boolean(),
  backDate: z.boolean(),
  backDateLimitDays: whole(365).nullable(),
  futureDateLimit: z.boolean(),
  attachmentRequired: z.boolean(),
  attachmentRule: z.enum(ATTACHMENT_RULES).nullable(),
  encashment: z.boolean(),
  encashmentMin: daysNumber.nullable(),
  encashmentMax: daysNumber.nullable(),
  carryForward: z.boolean(),
  proRated: z.boolean(),
  gender: z.enum(LEAVE_GENDER_RULES),
  maritalStatus: z.enum(LEAVE_MARITAL_RULES),
  applyInProbation: z.boolean(),
  minExperienceMonths: whole(600),
  maxApplications: whole(999).nullable(),
  gapMonths: whole(120).nullable(),
  tenure: z.enum(LEAVE_TENURES),
  balanceBasis: z.enum(BALANCE_BASES),
  accumulativeCount: whole(99).nullable(),
  experienceSlabs: z
    .array(z.object({ minMonths: whole(600), maxMonths: whole(600), balance: daysNumber }))
    .max(12),
  shortLeaveSlabs: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        balance: z.number().min(0).max(1),
        unit: z.enum(SHORT_SLAB_UNITS),
        value: z.number().min(0).max(1440),
      }),
    )
    .max(12),
})
type TypeInput = z.infer<typeof typeSchema>

/** How many leave applications (of any status) use the type. */
function usageOf(typeId: string): number {
  return standardRequests
    .all()
    .filter((record) => isLeave(record) && leaveStored(record).leaveTypeId === typeId).length
}

const presentType = (type: StoredLeaveType): LeaveType => ({ ...type, inUse: usageOf(type.id) })

/** The rules between the fields; the field errors land on the form. */
function checkType(input: TypeInput, ignoreId: string | null): Response | null {
  const others = leaveTypes.all().filter((type) => type.id !== ignoreId)
  if (others.some((type) => same(type.title, input.title))) {
    return conflict('A leave type with this title already exists.', {
      title: 'A leave type with this title already exists',
    })
  }
  if (others.some((type) => same(type.shortCode, input.shortCode))) {
    return conflict('A leave type with this short code already exists.', {
      shortCode: 'This short code is taken',
    })
  }
  if (input.attachmentRequired && !input.attachmentRule) {
    return invalid('Say what to do when the attachment is missing.', {
      attachmentRule: 'Choose what to do',
    })
  }
  if (
    input.encashment &&
    input.encashmentMin !== null &&
    input.encashmentMax !== null &&
    input.encashmentMin > input.encashmentMax
  ) {
    return invalid('Encashment Min Limit is above the Max Limit.', {
      encashmentMax: 'Enter at least the Min Limit',
    })
  }
  if (input.balanceBasis === 'experience') {
    if (input.experienceSlabs.length === 0) {
      return invalid('Add at least one experience slab.', {
        experienceSlabs: 'Add at least one slab',
      })
    }
    const sorted = [...input.experienceSlabs].sort((a, b) => a.minMonths - b.minMonths)
    for (const [index, slab] of sorted.entries()) {
      if (slab.maxMonths < slab.minMonths) {
        return invalid('An experience slab ends before it starts.', {
          experienceSlabs: 'Maximum Months must be at least Minimum Months',
        })
      }
      const previous = sorted[index - 1]
      if (previous && slab.minMonths <= previous.maxMonths) {
        return invalid('The experience slabs overlap.', {
          experienceSlabs: 'The slabs overlap',
        })
      }
    }
  }
  return null
}

/** The stored shape: the dependent fields of a switch that is off are cleared. */
function normaliseType(input: TypeInput): TypeInput {
  return {
    ...input,
    backDateLimitDays: input.backDate ? input.backDateLimitDays : null,
    attachmentRule: input.attachmentRequired ? input.attachmentRule : null,
    encashmentMin: input.encashment ? input.encashmentMin : null,
    encashmentMax: input.encashment ? input.encashmentMax : null,
    experienceSlabs: input.balanceBasis === 'experience' ? input.experienceSlabs : [],
    shortLeaveSlabs: input.shortLeave ? input.shortLeaveSlabs : [],
  }
}

// --- Leave Policies -------------------------------------------------------------------------------

const policySchema = z.object({
  title: z.string().trim().min(1).max(80),
  kind: z.enum(POLICY_KINDS),
  level: z.enum(POLICY_LEVELS),
  allowHalfDay: z.boolean(),
  allowShortLeave: z.boolean(),
  enforced: z.boolean(),
  active: z.boolean(),
})
type PolicyInput = z.infer<typeof policySchema>

const enrollSchema = z.object({ employeeIds: z.array(z.string().min(1)).max(200) })

const presentPolicy = (policy: StoredLeavePolicy): LeavePolicy => ({
  id: policy.id,
  title: policy.title,
  kind: policy.kind,
  level: policy.level,
  allowHalfDay: policy.allowHalfDay,
  allowShortLeave: policy.allowShortLeave,
  enforced: policy.enforced,
  active: policy.active,
  enrolled: policy.enrolledIds.map(ref),
  enrolledCount: policy.level === 'company' ? DIRECTORY.length : policy.enrolledIds.length,
  createdAt: policy.createdAt,
})

/** One company level policy of each kind; titles unique. */
function checkPolicy(input: PolicyInput, ignoreId: string | null): Response | null {
  const others = leavePolicies.all().filter((policy) => policy.id !== ignoreId)
  if (others.some((policy) => same(policy.title, input.title))) {
    return conflict('A policy with this title already exists.', {
      title: 'A policy with this title already exists',
    })
  }
  const company = others.find((policy) => policy.level === 'company' && policy.kind === input.kind)
  if (input.level === 'company' && company) {
    return conflict(
      `"${company.title}" is already the company level policy of this kind; edit it or make this an employee level policy.`,
      { level: 'There is already a company level policy of this kind' },
    )
  }
  return null
}

export const leaveSettingsHandlers: HttpHandler[] = [
  // --- General Settings ---
  http.get(path('/settings'), async ({ request }) => {
    const unauthorized = await guard(request)
    if (unauthorized) return unauthorized
    return HttpResponse.json<ApiItem<LeaveSettings>>({ data: publicLeaveSettings() })
  }),

  http.put(path('/settings'), async ({ request }) => {
    const unauthorized = await guard(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, settingsSchema)
    if (!parsed.success) return invalid('Some fields are not valid.')
    leaveSettingsStore.update('settings', { id: 'settings', ...parsed.data })
    return HttpResponse.json<ApiItem<LeaveSettings>>({ data: publicLeaveSettings() })
  }),

  // --- Leave Types ---
  http.get(path('/types'), async ({ request }) => {
    const unauthorized = await guard(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const query = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const status = url.searchParams.get('status')
    const { page, pageSize } = readPageParams(url)
    const list = leaveTypes
      .all()
      .filter(
        (type) =>
          (!query ||
            type.title.toLowerCase().includes(query) ||
            type.shortCode.toLowerCase().includes(query)) &&
          (!status || (status === 'active') === type.active),
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const result = paginate(list, page, pageSize)
    return HttpResponse.json<Paginated<LeaveType>>({
      ...result,
      data: result.data.map(presentType),
    })
  }),

  http.post(path('/types'), async ({ request }) => {
    const unauthorized = await guard(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, typeSchema)
    if (!parsed.success) return invalid('Some fields are not valid.')
    const refused = checkType(parsed.data, null)
    if (refused) return refused
    const type: StoredLeaveType = {
      ...normaliseType(parsed.data),
      id: createId('lt'),
      createdAt: new Date().toISOString(),
    }
    leaveTypes.insert(type)
    return HttpResponse.json<ApiItem<LeaveType>>({ data: presentType(type) }, { status: 201 })
  }),

  http.put(path('/types/:id'), async ({ request, params }) => {
    const unauthorized = await guard(request)
    if (unauthorized) return unauthorized
    const type = typeof params.id === 'string' ? leaveTypes.find(params.id) : undefined
    if (!type) return notFound()
    const parsed = await readBody(request, typeSchema)
    if (!parsed.success) return invalid('Some fields are not valid.')
    const refused = checkType(parsed.data, type.id)
    if (refused) return refused
    const next: StoredLeaveType = { ...type, ...normaliseType(parsed.data) }
    leaveTypes.update(type.id, next)
    return HttpResponse.json<ApiItem<LeaveType>>({ data: presentType(next) })
  }),

  http.delete(path('/types/:id'), async ({ request, params }) => {
    const unauthorized = await guard(request)
    if (unauthorized) return unauthorized
    const type = typeof params.id === 'string' ? leaveTypes.find(params.id) : undefined
    if (!type) return notFound()
    const used = usageOf(type.id)
    if (used > 0) {
      return conflict(
        `"${type.title}" is used by ${String(used)} leave application${used === 1 ? '' : 's'} and cannot be deleted. Switch Is Active off to stop offering it.`,
      )
    }
    leaveTypes.remove(type.id)
    return new HttpResponse(null, { status: 204 })
  }),

  // --- Leave Policies ---
  http.get(path('/policies'), async ({ request }) => {
    const unauthorized = await guard(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const { page, pageSize } = readPageParams(url)
    const list = [...leavePolicies.all()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const result = paginate(list, page, pageSize)
    return HttpResponse.json<Paginated<LeavePolicy>>({
      ...result,
      data: result.data.map(presentPolicy),
    })
  }),

  http.post(path('/policies'), async ({ request }) => {
    const unauthorized = await guard(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, policySchema)
    if (!parsed.success) return invalid('Some fields are not valid.')
    const refused = checkPolicy(parsed.data, null)
    if (refused) return refused
    const policy: StoredLeavePolicy = {
      ...parsed.data,
      id: createId('lp'),
      enrolledIds: [],
      createdAt: new Date().toISOString(),
    }
    leavePolicies.insert(policy)
    return HttpResponse.json<ApiItem<LeavePolicy>>({ data: presentPolicy(policy) }, { status: 201 })
  }),

  http.put(path('/policies/:id'), async ({ request, params }) => {
    const unauthorized = await guard(request)
    if (unauthorized) return unauthorized
    const policy = typeof params.id === 'string' ? leavePolicies.find(params.id) : undefined
    if (!policy) return notFound()
    const parsed = await readBody(request, policySchema)
    if (!parsed.success) return invalid('Some fields are not valid.')
    const refused = checkPolicy(parsed.data, policy.id)
    if (refused) return refused
    const next: StoredLeavePolicy = {
      ...policy,
      ...parsed.data,
      // A company level policy applies to everyone: nobody is enrolled by name.
      enrolledIds: parsed.data.level === 'company' ? [] : policy.enrolledIds,
    }
    leavePolicies.update(policy.id, next)
    return HttpResponse.json<ApiItem<LeavePolicy>>({ data: presentPolicy(next) })
  }),

  http.delete(path('/policies/:id'), async ({ request, params }) => {
    const unauthorized = await guard(request)
    if (unauthorized) return unauthorized
    const policy = typeof params.id === 'string' ? leavePolicies.find(params.id) : undefined
    if (!policy) return notFound()
    leavePolicies.remove(policy.id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.put(path('/policies/:id/enrollments'), async ({ request, params }) => {
    const unauthorized = await guard(request)
    if (unauthorized) return unauthorized
    const policy = typeof params.id === 'string' ? leavePolicies.find(params.id) : undefined
    if (!policy) return notFound()
    if (policy.level === 'company') {
      return invalid('A company level policy applies to every employee; nobody is enrolled in it.')
    }
    const parsed = await readBody(request, enrollSchema)
    if (!parsed.success) return invalid('Choose the employees.')
    const ids = [...new Set(parsed.data.employeeIds)]
    if (ids.some((id) => !findEmployee(id))) return invalid('Choose employees from the directory.')
    // One employee level policy per person: enrolling here takes them out of another.
    for (const other of leavePolicies.all()) {
      if (other.id === policy.id || other.level !== 'employee') continue
      if (other.enrolledIds.some((id) => ids.includes(id))) {
        leavePolicies.update(other.id, {
          ...other,
          enrolledIds: other.enrolledIds.filter((id) => !ids.includes(id)),
        })
      }
    }
    const next: StoredLeavePolicy = { ...policy, enrolledIds: ids }
    leavePolicies.update(policy.id, next)
    return HttpResponse.json<ApiItem<LeavePolicy>>({ data: presentPolicy(next) })
  }),
]
