import { differenceInCalendarDays, format, intervalToDuration, parseISO, subYears } from 'date-fns'
import { http } from 'msw'
import { z } from 'zod'

import {
  CHECKLIST_FIELD_TYPES,
  type ChecklistField,
  type ChecklistValue,
  type EmployeeCardInfo,
  type EndOfEmployment,
  type EndOfEmploymentDetail,
  type EndOfEmploymentInput,
  type EndOfEmploymentRow,
  EOE_REASONS,
  type OffboardingChecklist,
} from '@/features/offboarding'

import { allocations, clearances } from '../assets/db'
import { DIRECTORY, findEmployee } from '../employees/seed'
import { finalSettlements } from '../payroll/db'
import { employeeProfile, employeeRef, isActive } from '../payroll/engine'
import {
  conflict,
  day,
  invalid,
  nextCode,
  notFound,
  ok,
  page,
  param,
  readBody,
  rejected,
} from '../payroll/http'
import { branches, locations } from '../settings/handlers'
import { apiPath, createId, latency, requireAuth } from '../utils'
import { activeChecklistFields, checklists, endOfEmployments } from './db'

const base = (path: string) => apiPath(`/offboarding${path}`)

const authed = async (request: Request) => {
  await latency()
  return requireAuth(request)
}

const today = () => format(new Date(), 'yyyy-MM-dd')
const now = () => new Date().toISOString()
const nameOf = (id: string) => findEmployee(id)?.name ?? id

const employeeId = z
  .string()
  .min(1, 'Choose the employee')
  .refine((id) => Boolean(findEmployee(id)), { message: 'Choose the employee' })

// --- the person's card ----------------------------------------------------------------------------

/** A steady number per person, for the sample birthday and phone. */
function hashOf(id: string) {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 1_000_003
  return hash
}

const plural = (count: number, word: string) => `${String(count)} ${word}`

function cardOf(id: string, until?: string | null): EmployeeCardInfo {
  const ref = employeeRef(id)
  const profile = employeeProfile(id)
  const hash = hashOf(id)
  const birthday = subYears(new Date(), 24 + (hash % 28))
  birthday.setDate(birthday.getDate() - (hash % 330))
  const age = intervalToDuration({ start: birthday, end: new Date() })
  const end = until ? parseISO(until) : new Date()
  const worked = profile.joiningDate
    ? intervalToDuration({ start: parseISO(profile.joiningDate), end })
    : {}
  const [first = '', ...rest] = ref.name
    .replace(/^Dr\s+/, '')
    .toLowerCase()
    .split(/\s+/)
  return {
    id,
    name: ref.name,
    designation: ref.designation,
    code: ref.code,
    photoUrl: ref.photoUrl,
    age: `${plural(age.years ?? 0, 'years')}, ${plural(age.months ?? 0, 'Months')}, ${plural(age.days ?? 0, 'Days')}`,
    email: `${[first, ...rest].join('.')}@topedge.tech`,
    phone: `03${String(hash % 10)}${String((hash >> 3) % 10)}-${String(1_000_000 + (hash % 9_000_000)).slice(0, 7)}`,
    experience: `${plural(worked.years ?? 0, 'Year')} ${plural(worked.months ?? 0, 'Month')} ${plural(worked.days ?? 0, 'Days')}`,
  }
}

// --- the record ----------------------------------------------------------------------------------

const missing = (value: ChecklistValue | undefined) =>
  value === null || value === undefined || value === ''

/**
 * What keeps a record pending: the Final Settlement still open, the clearance
 * not approved (when the person holds assets), required checklist answers.
 */
function waitingFor(record: EndOfEmployment): string[] {
  const waiting: string[] = []
  if (record.finalSettlement) {
    const settlement = record.finalSettlementId
      ? finalSettlements.find(record.finalSettlementId)
      : undefined
    if (settlement?.status !== 'completed') waiting.push('Final Settlement')
  }
  if (record.assetClearance) {
    const form = record.clearanceId ? clearances.find(record.clearanceId) : undefined
    const holds = allocations
      .all()
      .some((item) => item.employeeId === record.employeeId && item.deallocationDate === null)
    if (form ? form.status !== 'approved' : holds) waiting.push('Asset Clearance')
  }
  const unanswered = activeChecklistFields().filter(
    (field) => field.required && missing(record.checklist[field.id]),
  )
  if (unanswered.length > 0) waiting.push('Checklist')
  return waiting
}

/** Completed once nothing is waiting (stamped the first time); back to pending if that changes. */
function refreshed(record: EndOfEmployment): EndOfEmployment {
  const done = waitingFor(record).length === 0
  const next: EndOfEmployment = done
    ? { ...record, status: 'completed', completedAt: record.completedAt ?? now() }
    : record.rehire
      ? record
      : { ...record, status: 'pending', completedAt: null }
  if (next.status !== record.status || next.completedAt !== record.completedAt) {
    endOfEmployments.update(record.id, next)
  }
  return next
}

function rowOf(record: EndOfEmployment): EndOfEmploymentRow {
  const ref = employeeRef(record.employeeId)
  const profile = employeeProfile(record.employeeId)
  return {
    id: record.id,
    employee: ref,
    branch: profile.branch,
    location: profile.location,
    department: ref.department,
    designation: ref.designation,
    date: record.lastWorkingDate ?? record.createdAt.slice(0, 10),
    createdAt: record.createdAt,
    completedAt: record.completedAt,
    status: record.status,
    rehired: record.rehire !== null,
  }
}

function detailOf(record: EndOfEmployment): EndOfEmploymentDetail {
  const settlement = record.finalSettlementId
    ? finalSettlements.find(record.finalSettlementId)
    : undefined
  const form = record.clearanceId ? clearances.find(record.clearanceId) : undefined
  return {
    ...record,
    card: cardOf(record.employeeId, record.lastWorkingDate),
    delegatee: record.delegateeId ? employeeRef(record.delegateeId) : null,
    waitingFor: waitingFor(record),
    finalSettlementStatus: settlement?.status ?? null,
    clearanceStatus: form?.status ?? null,
  }
}

/** Ticking Final Settlement makes (or keeps up to date) the person's Payroll Final Settlement. */
function syncSettlement(record: EndOfEmployment): EndOfEmployment {
  const current = record.finalSettlementId
    ? finalSettlements.find(record.finalSettlementId)
    : undefined
  if (!record.finalSettlement) {
    if (current?.status === 'pending') finalSettlements.remove(current.id)
    return current?.status === 'completed' ? record : { ...record, finalSettlementId: null }
  }
  const fields = {
    employeeId: record.employeeId,
    reason: record.reason,
    noticePeriod: record.noticePeriod,
    lastWorkingDate: record.lastWorkingDate ?? record.createdAt.slice(0, 10),
    finalSettlement: true,
    attachmentName: record.attachmentName,
    description: record.description,
  }
  if (current) {
    if (current.status === 'pending') finalSettlements.update(current.id, { ...current, ...fields })
    return record
  }
  // A settlement Payroll already has for the person is taken over rather than doubled.
  const existing = finalSettlements
    .all()
    .find((item) => item.employeeId === record.employeeId && item.status === 'pending')
  if (existing) {
    finalSettlements.update(existing.id, { ...existing, ...fields })
    return { ...record, finalSettlementId: existing.id }
  }
  const id = `fs_${record.id}`
  finalSettlements.insert({
    id,
    ...fields,
    resignationDate: record.createdAt.slice(0, 10),
    status: 'pending',
    payslipId: null,
  })
  return { ...record, finalSettlementId: id }
}

/** Unticking Asset Clearance drops a form that HR has not approved. */
function syncClearance(record: EndOfEmployment): EndOfEmployment {
  if (record.assetClearance || !record.clearanceId) return record
  const form = clearances.find(record.clearanceId)
  if (form?.status === 'approved') return record
  if (form) clearances.remove(form.id)
  return { ...record, clearanceId: null }
}

function checklistProblem(values: Record<string, ChecklistValue>) {
  for (const field of activeChecklistFields()) {
    const value = values[field.id]
    const key = `checklist.${field.id}`
    if (missing(value)) {
      if (field.required) return invalid(`Enter ${field.name}`, { [key]: `Enter ${field.name}` })
      continue
    }
    if (field.type === 'number') {
      const number = Number(value)
      if (!Number.isFinite(number))
        return invalid(`${field.name} must be a number`, { [key]: 'Enter a number' })
      if (field.min !== null && number < field.min) {
        return invalid(`${field.name} is at least ${String(field.min)}`, {
          [key]: `At least ${String(field.min)}`,
        })
      }
      if (field.max !== null && number > field.max) {
        return invalid(`${field.name} is at most ${String(field.max)}`, {
          [key]: `At most ${String(field.max)}`,
        })
      }
    }
    if (field.type === 'string') {
      const length = String(value).length
      if (field.min !== null && length < field.min) {
        return invalid(`${field.name} needs at least ${String(field.min)} characters`, {
          [key]: `At least ${String(field.min)} characters`,
        })
      }
      if (field.max !== null && length > field.max) {
        return invalid(`${field.name} takes at most ${String(field.max)} characters`, {
          [key]: `At most ${String(field.max)} characters`,
        })
      }
    }
    if (field.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      return invalid(`Choose ${field.name}`, { [key]: 'Choose a date' })
    }
  }
  return null
}

const recordSchema = z
  .object({
    employeeId,
    reason: z.enum(EOE_REASONS, { error: 'Choose the reason' }),
    noticePeriod: z.boolean(),
    lastWorkingDate: day.nullable(),
    finalSettlement: z.boolean(),
    assetClearance: z.boolean(),
    attachmentName: z.string().max(200).nullable(),
    description: z.string().trim().max(1000, 'Keep it under 1000 characters'),
    delegateeId: z.string().nullable(),
    checklist: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  })
  .refine((value) => !value.noticePeriod || value.lastWorkingDate !== null, {
    message: 'Choose the last working date',
    path: ['lastWorkingDate'],
  })
  .refine((value) => value.delegateeId !== value.employeeId, {
    message: 'Choose someone else as the delegatee',
    path: ['delegateeId'],
  })

function recordProblem(input: EndOfEmploymentInput, id?: string) {
  const open = endOfEmployments
    .all()
    .find(
      (item) => item.id !== id && item.employeeId === input.employeeId && item.status === 'pending',
    )
  if (open) {
    const message = `${nameOf(input.employeeId)} already has an end of employment record pending.`
    return conflict(message, 'DUPLICATE', { employeeId: message })
  }
  if (!id && !isActive(input.employeeId)) {
    const message = `${nameOf(input.employeeId)} no longer works here.`
    return invalid(message, { employeeId: message })
  }
  if (input.delegateeId && !findEmployee(input.delegateeId)) {
    return invalid('Choose the delegatee', { delegateeId: 'Choose the delegatee' })
  }
  return checklistProblem(input.checklist)
}

function create(input: EndOfEmploymentInput): EndOfEmployment {
  const record: EndOfEmployment = {
    id: createId('eoe'),
    ...input,
    lastWorkingDate: input.noticePeriod ? input.lastWorkingDate : today(),
    status: 'pending',
    createdAt: now(),
    completedAt: null,
    finalSettlementId: null,
    clearanceId: null,
    rehire: null,
  }
  const synced = syncSettlement(record)
  endOfEmployments.insert(synced)
  return refreshed(synced)
}

const importSchema = z.object({
  rows: z
    .array(
      z.object({
        employeeCode: z.string(),
        reason: z.string(),
        lastWorkingDate: z.string(),
        noticePeriod: z.boolean(),
        finalSettlement: z.boolean(),
        assetClearance: z.boolean(),
      }),
    )
    .min(1, 'The file has no rows')
    .max(2000),
})

const recordHandlers = [
  http.get(base('/lookups'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    return ok({
      employees: DIRECTORY.map((employee) => ({
        ...employeeRef(employee.id),
        status: isActive(employee.id) ? ('active' as const) : ('inactive' as const),
        branchId: employee.branchId,
        locationId: employee.branchId
          ? (branches.find(employee.branchId)?.locationId ?? null)
          : null,
      })),
      departments: [...new Set(DIRECTORY.map((employee) => employee.department))].sort(),
      designations: [...new Set(DIRECTORY.map((employee) => employee.jobTitle))].sort(),
      branches: branches.all().map((branch) => ({ id: branch.id, name: branch.name })),
      locations: locations.all().map((location) => ({ id: location.id, name: location.name })),
      checklistFields: activeChecklistFields(),
    })
  }),
  http.get(base('/employees/:id/card'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const id = String(params.id)
    if (!findEmployee(id)) return notFound('employee')
    return ok(cardOf(id))
  }),
  http.get(base('/end-of-employment'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const scope = param(url, 'scope') ?? 'all'
    const wanted = {
      locationId: param(url, 'locationId'),
      branchId: param(url, 'branchId'),
      department: param(url, 'department'),
      employeeId: param(url, 'employeeId'),
      designation: param(url, 'designation'),
      status: param(url, 'status'),
      noticePeriod: param(url, 'noticePeriod'),
      from: param(url, 'from'),
      to: param(url, 'to'),
    }
    const list = endOfEmployments
      .all()
      .map(refreshed)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((record) => {
        const employee = findEmployee(record.employeeId)
        const branch = employee?.branchId ? branches.find(employee.branchId) : undefined
        const row = rowOf(record)
        return (
          (scope === 'all' || record.status === scope) &&
          (!wanted.status || record.status === wanted.status) &&
          (!wanted.employeeId || record.employeeId === wanted.employeeId) &&
          (!wanted.branchId || employee?.branchId === wanted.branchId) &&
          (!wanted.locationId || branch?.locationId === wanted.locationId) &&
          (!wanted.department || row.department === wanted.department) &&
          (!wanted.designation || row.designation === wanted.designation) &&
          (!wanted.noticePeriod || (wanted.noticePeriod === 'yes') === record.noticePeriod) &&
          (!wanted.from || row.date >= wanted.from) &&
          (!wanted.to || row.date <= wanted.to)
        )
      })
      .map(rowOf)
    return page(url, list)
  }),
  http.get(base('/end-of-employment/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const record = endOfEmployments.find(String(params.id))
    return record ? ok(detailOf(refreshed(record))) : notFound('end of employment record')
  }),
  http.post(base('/end-of-employment'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, recordSchema)
    if (!parsed.success) return rejected(parsed.error)
    const problem = recordProblem(parsed.data)
    if (problem) return problem
    return ok(detailOf(create(parsed.data)))
  }),
  http.put(base('/end-of-employment/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const existing = endOfEmployments.find(String(params.id))
    if (!existing) return notFound('end of employment record')
    if (existing.status === 'completed') {
      return conflict('A completed end of employment record cannot be changed.')
    }
    const parsed = await readBody(request, recordSchema)
    if (!parsed.success) return rejected(parsed.error)
    const input = { ...parsed.data, employeeId: existing.employeeId }
    const problem = recordProblem(input, existing.id)
    if (problem) return problem
    const next = syncClearance(
      syncSettlement({
        ...existing,
        ...input,
        lastWorkingDate: input.noticePeriod
          ? input.lastWorkingDate
          : existing.createdAt.slice(0, 10),
      }),
    )
    endOfEmployments.update(existing.id, next)
    return ok(detailOf(refreshed(next)))
  }),
  http.delete(base('/end-of-employment/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const record = endOfEmployments.find(String(params.id))
    if (!record) return notFound('end of employment record')
    if (record.status === 'completed') {
      return conflict('A completed end of employment record cannot be deleted.')
    }
    syncClearance({ ...record, assetClearance: false })
    syncSettlement({ ...record, finalSettlement: false })
    endOfEmployments.remove(record.id)
    return ok({ id: record.id })
  }),
  http.post(base('/end-of-employment/:id/rehire'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const record = endOfEmployments.find(String(params.id))
    if (!record) return notFound('end of employment record')
    if (record.status !== 'completed') {
      return conflict('Only someone whose end of employment is completed can be rehired.')
    }
    if (record.rehire) return conflict(`${nameOf(record.employeeId)} has been rehired already.`)
    const parsed = await readBody(request, z.object({ joiningDate: day }))
    if (!parsed.success) return rejected(parsed.error)
    const last = record.lastWorkingDate ?? record.createdAt.slice(0, 10)
    if (differenceInCalendarDays(parseISO(parsed.data.joiningDate), parseISO(last)) <= 0) {
      const message = 'The joining date must be after the last working date'
      return invalid(message, { joiningDate: message })
    }
    const next = { ...record, rehire: { joiningDate: parsed.data.joiningDate, at: now() } }
    endOfEmployments.update(record.id, next)
    return ok(detailOf(next))
  }),
  http.post(base('/end-of-employment/import'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, importSchema)
    if (!parsed.success) return rejected(parsed.error)
    const errors: string[] = []
    let created = 0
    parsed.data.rows.forEach((row, index) => {
      const line = `Line ${String(index + 2)}`
      const employee = DIRECTORY.find(
        (person) =>
          employeeRef(person.id).code.toLowerCase() === row.employeeCode.trim().toLowerCase(),
      )
      const reason = EOE_REASONS.find((item) => item === row.reason.trim().toLowerCase())
      const date = row.lastWorkingDate.trim()
      if (!employee) {
        errors.push(`${line}: no employee with code ${row.employeeCode}`)
        return
      }
      if (!reason) {
        errors.push(`${line}: the reason must be one of ${EOE_REASONS.join(', ')}`)
        return
      }
      if (row.noticePeriod && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        errors.push(`${line}: the last working date must be yyyy-mm-dd`)
        return
      }
      const input: EndOfEmploymentInput = {
        employeeId: employee.id,
        reason,
        noticePeriod: row.noticePeriod,
        lastWorkingDate: row.noticePeriod ? date : null,
        finalSettlement: row.finalSettlement,
        assetClearance: row.assetClearance,
        attachmentName: null,
        description: '',
        delegateeId: null,
        checklist: {},
      }
      const problem = endOfEmployments
        .all()
        .some((item) => item.employeeId === employee.id && item.status === 'pending')
      if (problem) {
        errors.push(`${line}: ${employee.name} already has a record pending`)
      } else if (!isActive(employee.id)) {
        errors.push(`${line}: ${employee.name} no longer works here`)
      } else {
        create(input)
        created += 1
      }
    })
    return ok({ created, errors })
  }),
]

// --- Settings → Off Boarding Checklist ------------------------------------------------------------

const fieldSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, 'Enter the name').max(60, 'Keep it under 60 characters'),
    type: z.enum(CHECKLIST_FIELD_TYPES, { error: 'Choose the type' }),
    required: z.boolean(),
    min: z.number().nullable(),
    max: z.number().nullable(),
  })
  .refine((value) => value.min === null || value.max === null || value.min <= value.max, {
    message: 'Min cannot be more than Max',
    path: ['max'],
  })

const checklistSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter the name').max(80, 'Keep it under 80 characters'),
    active: z.boolean(),
    description: z.string().trim().max(500, 'Keep it under 500 characters'),
    fields: z.array(fieldSchema).max(50),
  })
  .refine(
    (value) =>
      new Set(value.fields.map((field) => field.name.toLowerCase())).size === value.fields.length,
    { message: 'Each field name can be used once', path: ['fields'] },
  )

const toFields = (fields: z.infer<typeof checklistSchema>['fields']): ChecklistField[] =>
  fields.map((field) => ({
    id: field.id ?? createId('cf'),
    name: field.name,
    type: field.type,
    required: field.required,
    // Only numbers and strings have conditions.
    min: field.type === 'number' || field.type === 'string' ? field.min : null,
    max: field.type === 'number' || field.type === 'string' ? field.max : null,
  }))

const nameTaken = (name: string, id?: string) =>
  checklists.all().some((item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase())

const checklistHandlers = [
  http.get(base('/checklists'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const name = (param(url, 'name') ?? '').toLowerCase()
    const code = (param(url, 'code') ?? '').toLowerCase()
    const list = checklists
      .all()
      .filter(
        (item) => item.name.toLowerCase().includes(name) && item.code.toLowerCase().includes(code),
      )
      .sort((a, b) => a.code.localeCompare(b.code))
    return page(url, list)
  }),
  http.get(base('/checklists/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const item = checklists.find(String(params.id))
    return item ? ok(item) : notFound('checklist')
  }),
  http.post(base('/checklists'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, checklistSchema)
    if (!parsed.success) return rejected(parsed.error)
    if (nameTaken(parsed.data.name)) {
      return conflict('A checklist with this name already exists', 'DUPLICATE', {
        name: 'A checklist with this name already exists',
      })
    }
    const item: OffboardingChecklist = {
      id: createId('ecl'),
      code: nextCode(
        'ECL-',
        checklists.all().map((entry) => entry.code),
      ),
      ...parsed.data,
      fields: toFields(parsed.data.fields),
      createdAt: now(),
    }
    checklists.insert(item)
    return ok(item)
  }),
  http.put(base('/checklists/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const existing = checklists.find(String(params.id))
    if (!existing) return notFound('checklist')
    const parsed = await readBody(request, checklistSchema)
    if (!parsed.success) return rejected(parsed.error)
    if (nameTaken(parsed.data.name, existing.id)) {
      return conflict('A checklist with this name already exists', 'DUPLICATE', {
        name: 'A checklist with this name already exists',
      })
    }
    const item = { ...existing, ...parsed.data, fields: toFields(parsed.data.fields) }
    checklists.update(existing.id, item)
    return ok(item)
  }),
]

export const offboardingHandlers = [...recordHandlers, ...checklistHandlers]
