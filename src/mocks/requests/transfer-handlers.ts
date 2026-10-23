import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  type RequestAction,
  type RequestDetail,
  type RequestPage,
  type TransferLookups,
  type TransferRequest,
} from '@/features/requests'
import type { ApiItem } from '@/types/api'

import { DIRECTORY, findEmployee } from '../employees/seed'
import { profileOf } from '../scheduling/seed'
import { branches, locations } from '../settings/handlers'
import { latency, paginate, readPageParams, requireAuth } from '../utils'
import { currentPlace, transferRequests } from './db'
import { applyTransfer, revertTransfer } from './effects'
import { historyEntry } from './flow'
import {
  base,
  countsOf,
  forbidden,
  invalid,
  notFound,
  now,
  readBody,
  text,
  today,
  toStep,
} from './http'
import { delegatorsOf, ME, mustFind, ref, requestEmployee } from './people'
import { restrictionFor } from './settings-db'
import {
  decideTransfer,
  decideTransferCancel,
  newTransferRecord,
  requestTransferCancel,
  stepOf,
  type StoredTransferRequest,
} from './transfer-flow'

/*
 * Transfer requests: the same REST shape as Punch and Shift
 * (/requests/transfer, /approvals, /:id, /:id/decision, /:id/cancel), plus
 * the Filters dialog's values on the lists and the form's look-ups.
 */

const transferSchema = z.object({
  employeeId: z.string().min(1).optional(),
  locationId: z.string().min(1),
  branchId: z.string().min(1),
  department: z.string().trim().min(1).max(80),
  lineManagerId: z.string().min(1),
  finalAuthorityId: z.string().min(1),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attachmentName: z.string().max(200).nullable(),
  description: text,
  application: z.string().max(20_000),
})
type TransferInput = z.infer<typeof transferSchema>

const decisionSchema = z.object({ decision: z.enum(['approve', 'reject']), remarks: text })

const departments = () => [...new Set(DIRECTORY.map((employee) => employee.department))].sort()
const isActive = (employeeId: string) => {
  const employee = findEmployee(employeeId)
  return employee ? profileOf(employee).status === 'active' : false
}

// --- serializing -----------------------------------------------------------------

/** Your own steps, and those of people who delegated their transfer approvals to you. */
const mayDecideFor = (approverId: string) =>
  approverId === ME || delegatorsOf(ME, 'transfer').includes(approverId)

function actionsFor(record: StoredTransferRequest): RequestAction[] {
  const mine = record.employeeId === ME || record.createdById === ME
  const untouched = record.flow.every(
    (step) => step.status === 'pending' || step.status === 'waiting',
  )
  const step = stepOf(record)
  const actions: RequestAction[] = ['view', 'flow', 'history']
  if (record.status === 'pending' && mine && untouched) actions.push('edit', 'delete')
  if (record.status === 'completed' && mine) actions.push('cancel')
  if (step && record.employeeId !== ME && mayDecideFor(step.approverId)) actions.push('decide')
  return actions
}

const locationName = (id: string | null) => (id ? (locations.find(id)?.name ?? null) : null)
const branchName = (id: string | null) => (id ? (branches.find(id)?.name ?? null) : null)

function serialize(record: StoredTransferRequest): TransferRequest {
  const step = stepOf(record)
  const { payload } = record
  return {
    id: record.id,
    code: record.code,
    kind: 'transfer',
    status: record.status,
    employee: requestEmployee(mustFind(record.employeeId)),
    createdBy: ref(record.createdById),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    flow: [
      ...record.flow.map(toStep),
      ...(record.cancelStep
        ? [
            {
              ...toStep(record.cancelStep),
              authority: `${record.cancelStep.authority} (Cancellation)`,
            },
          ]
        : []),
    ],
    consents: record.consents.map((consent) => ({
      person: ref(consent.personId),
      status: consent.status,
      remarks: consent.remarks,
    })),
    cancelReason: record.cancelReason,
    currentStep: step ? toStep(step) : null,
    actions: actionsFor(record),
    payload: {
      location: {
        id: payload.locationId,
        name: locationName(payload.locationId) ?? payload.locationId,
      },
      branch: { id: payload.branchId, name: branchName(payload.branchId) ?? payload.branchId },
      department: payload.department,
      current: {
        location: locationName(payload.fromLocationId),
        branch: branchName(payload.fromBranchId),
        department: payload.fromDepartment,
      },
      lineManager: ref(payload.lineManagerId),
      finalAuthority: ref(payload.finalAuthorityId),
      effectiveDate: payload.effectiveDate,
      attachmentName: payload.attachmentName,
      description: payload.description,
      application: payload.application,
    },
  }
}

/** The Filters dialog's values; the status tabs count what is left after them. */
function matchesFilters(record: StoredTransferRequest, url: URL): boolean {
  const get = (name: string) => url.searchParams.get(name) ?? ''
  const { payload } = record
  const checks: [string, (value: string) => boolean][] = [
    ['employeeId', (value) => record.employeeId === value],
    ['locationId', (value) => payload.locationId === value],
    ['branchId', (value) => payload.branchId === value],
    ['department', (value) => payload.department === value],
    ['effectiveDate', (value) => payload.effectiveDate === value],
    [
      'employmentStatus',
      (value) => value === 'all' || profileOf(mustFind(record.employeeId)).status === value,
    ],
    ['delegatorId', (value) => record.flow.some((step) => step.approverId === value)],
    ['nextRequesteeId', (value) => stepOf(record)?.approverId === value],
    ['from', (value) => payload.effectiveDate >= value],
    ['to', (value) => payload.effectiveDate <= value],
  ]
  return checks.every(([name, test]) => {
    const value = get(name)
    return value === '' || test(value)
  })
}

function listResponse(url: URL, records: StoredTransferRequest[]) {
  const status = url.searchParams.get('status')
  const { page, pageSize } = readPageParams(url)
  const sorted = records
    .filter((record) => matchesFilters(record, url))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const filtered = status ? sorted.filter((record) => record.status === status) : sorted
  const result = paginate(filtered, page, pageSize)
  return HttpResponse.json<RequestPage<TransferRequest>>({
    ...result,
    data: result.data.map(serialize),
    counts: countsOf(sorted),
  })
}

const item = (record: StoredTransferRequest) =>
  HttpResponse.json<ApiItem<TransferRequest>>({ data: serialize(record) })

// --- validation --------------------------------------------------------------------

function validateTransfer(
  input: TransferInput,
  employeeId: string,
  from: Pick<
    StoredTransferRequest['payload'],
    'fromLocationId' | 'fromBranchId' | 'fromDepartment'
  >,
  ignoreId: string | null,
): Response | StoredTransferRequest['payload'] {
  const location = locations.find(input.locationId)
  if (!location) return invalid('Choose a location.', { locationId: 'Choose a location' })
  const branch = branches.find(input.branchId)
  if (branch?.locationId !== location.id) {
    return invalid(`Choose a branch in ${location.name}.`, {
      branchId: `Choose a branch in ${location.name}`,
    })
  }
  if (!departments().includes(input.department)) {
    return invalid('Choose a department.', { department: 'Choose a department' })
  }
  for (const [field, id] of [
    ['lineManagerId', input.lineManagerId],
    ['finalAuthorityId', input.finalAuthorityId],
  ] as const) {
    if (id === employeeId) {
      return invalid('Choose someone other than the employee.', {
        [field]: 'Choose someone other than the employee',
      })
    }
    if (!isActive(id)) {
      return invalid('Choose an active employee.', { [field]: 'Choose an active employee' })
    }
  }
  if (input.effectiveDate < today()) {
    return invalid('Choose today or a later day.', {
      effectiveDate: 'Choose today or a later day',
    })
  }
  const closed = restrictionFor('transfer', input.effectiveDate, employeeId)
  if (closed) return invalid(closed, { effectiveDate: closed })
  if (from.fromBranchId === branch.id && from.fromDepartment === input.department) {
    return invalid('The employee already works in this branch and department.', {
      branchId: 'Choose a different branch or department',
    })
  }
  const pending = transferRequests
    .all()
    .some(
      (record) =>
        record.id !== ignoreId && record.employeeId === employeeId && record.status === 'pending',
    )
  if (pending) {
    return invalid('A transfer request for this employee is already pending.', {
      employeeId: 'A transfer request for this employee is already pending',
    })
  }
  return {
    ...from,
    locationId: location.id,
    branchId: branch.id,
    department: input.department,
    lineManagerId: input.lineManagerId,
    finalAuthorityId: input.finalAuthorityId,
    effectiveDate: input.effectiveDate,
    attachmentName: input.attachmentName,
    description: input.description,
    application: input.application,
  }
}

function nextCode(): string {
  const highest = transferRequests.all().reduce((max, record) => {
    const number = Number(record.code.slice(-4))
    return Number.isFinite(number) ? Math.max(max, number) : max
  }, 0)
  return `RQ-TRF-${String(highest + 1).padStart(4, '0')}`
}

const find = (id: unknown) => (typeof id === 'string' ? transferRequests.find(id) : undefined)
const save = (record: StoredTransferRequest) => transferRequests.update(record.id, record)

// --- handlers ---------------------------------------------------------------------------

const path = (suffix = '') => base(`/transfer${suffix}`)

export const transferHandlers = [
  http.get(base('/lookups/transfer'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name)
    return HttpResponse.json<ApiItem<TransferLookups>>({
      data: {
        employees: DIRECTORY.map((employee) => ({
          ...ref(employee.id),
          department: employee.department,
          designation: employee.jobTitle,
          locationId: currentPlace(employee.id).fromLocationId,
          branchId: employee.branchId,
          active: profileOf(employee).status === 'active',
        })).sort(byName),
        locations: locations
          .all()
          .map((location) => ({ id: location.id, name: location.name }))
          .sort(byName),
        branches: branches
          .all()
          .map((branch) => ({ id: branch.id, name: branch.name, locationId: branch.locationId }))
          .sort(byName),
        departments: departments(),
        delegators: delegatorsOf(ME, 'transfer').map(ref),
      },
    })
  }),

  http.get(path(), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const all = transferRequests.all()
    const scope = url.searchParams.get('scope') ?? 'my'
    return listResponse(
      url,
      scope === 'all' ? all : all.filter((record) => record.employeeId === ME),
    )
  }),

  http.get(path('/approvals'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const approvers =
      url.searchParams.get('view') === 'delegates' ? delegatorsOf(ME, 'transfer') : [ME]
    const records = transferRequests
      .all()
      .filter(
        (record) =>
          record.employeeId !== ME &&
          [...record.flow, ...(record.cancelStep ? [record.cancelStep] : [])].some(
            (step) => approvers.includes(step.approverId) && step.status !== 'waiting',
          ),
      )
    return listResponse(url, records)
  }),

  http.get(path('/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const record = find(params.id)
    if (!record) return notFound()
    const history = [...record.history]
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((entry) => ({
        id: entry.id,
        by: ref(entry.byId),
        delegate: entry.delegate,
        status: entry.status,
        remarks: entry.remarks,
        at: entry.at,
      }))
    return HttpResponse.json<ApiItem<RequestDetail<TransferRequest>>>({
      data: { request: serialize(record), history },
    })
  }),

  http.post(path(), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, transferSchema)
    if (!parsed.success) return invalid('Some fields are not valid.')
    const employee = findEmployee(parsed.data.employeeId ?? ME)
    if (!employee || profileOf(employee).status !== 'active') {
      return invalid('Choose an active employee.', { employeeId: 'Choose an employee' })
    }
    const payload = validateTransfer(parsed.data, employee.id, currentPlace(employee.id), null)
    if (payload instanceof Response) return payload
    const record = newTransferRecord(
      {
        id: `trq_${Date.now().toString(36)}`,
        code: nextCode(),
        employeeId: employee.id,
        createdById: ME,
        payload,
      },
      now(),
    )
    transferRequests.insert(record)
    return item(record)
  }),

  http.put(path('/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const record = find(params.id)
    if (!record) return notFound()
    if (!actionsFor(record).includes('edit')) {
      return forbidden('Only a pending request nobody has acted on can be edited.')
    }
    const parsed = await readBody(request, transferSchema)
    if (!parsed.success) return invalid('Some fields are not valid.')
    const payload = validateTransfer(parsed.data, record.employeeId, record.payload, record.id)
    if (payload instanceof Response) return payload
    const at = now()
    const next: StoredTransferRequest = {
      ...record,
      payload,
      updatedAt: at,
      history: [...record.history, historyEntry(ME, 'Edited', null, at)],
    }
    save(next)
    return item(next)
  }),

  http.delete(path('/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const record = find(params.id)
    if (!record) return notFound()
    if (!actionsFor(record).includes('delete')) {
      return forbidden('Only a pending request nobody has acted on can be deleted.')
    }
    transferRequests.remove(record.id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(path('/:id/decision'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const record = find(params.id)
    if (!record) return notFound()
    if (!actionsFor(record).includes('decide')) {
      return forbidden('This request is not waiting for your decision.')
    }
    const parsed = await readBody(request, decisionSchema)
    if (!parsed.success) return invalid('Some fields are not valid.')
    const { decision } = parsed.data
    const remarks = parsed.data.remarks || null
    if (decision === 'reject' && !remarks) {
      return invalid('Give a reason for rejecting.', { remarks: 'Give a reason for rejecting' })
    }
    const at = now()
    if (record.status === 'cancelling') {
      const next = decideTransferCancel(record, decision, ME, remarks, at)
      if (decision === 'approve') revertTransfer(record.id)
      save(next)
      return item(next)
    }
    const { record: next, completed } = decideTransfer(record, decision, ME, remarks, at)
    if (completed) applyTransfer(next)
    save(next)
    return item(next)
  }),

  http.post(path('/:id/cancel'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const record = find(params.id)
    if (!record) return notFound()
    if (!actionsFor(record).includes('cancel')) {
      return forbidden('Only your completed requests can be cancelled.')
    }
    const parsed = await readBody(request, z.object({ reason: z.string().trim().min(1).max(500) }))
    if (!parsed.success) {
      return invalid('Give a reason for cancellation.', {
        reason: 'Give a reason for cancellation',
      })
    }
    const next = requestTransferCancel(record, ME, parsed.data.reason, now())
    save(next)
    return item(next)
  }),
]
