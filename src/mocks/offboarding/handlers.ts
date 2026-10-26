import { format } from 'date-fns'
import { http } from 'msw'
import { z } from 'zod'

import {
  type ActiveChecklistField,
  CHECKLIST_FIELD_TYPES,
  type ChecklistAnswerValue,
  type ChecklistField,
  type EndOfEmployment,
  type EndOfEmploymentRow,
  EOE_REASONS,
  type OffboardingChecklist,
  type WaitingItem,
} from '@/features/offboarding'

import { allocations, clearances } from '../assets/db'
import {
  authed,
  conflict,
  created,
  day,
  fileIdSchema,
  fileRef,
  idSchema,
  invalid,
  matches,
  nextCode,
  nextVersion,
  noContent,
  notFound,
  now,
  ok,
  optionalId,
  optionalText,
  page,
  param,
  readBody,
  rejected,
} from '../assets/http'
import { isActive, personOf, sameUnit } from '../assets/people'
import { finalSettlements } from '../payroll/db'
import { jobTitles } from '../settings/handlers'
import { apiPath, createId } from '../utils'
import {
  activeChecklistFields,
  checklists,
  endOfEmployments,
  type StoredChecklist,
  type StoredEndOfEmployment,
  versionOf,
} from './db'

/*
 * The backend's /api/offboarding routes (backend/app/routers/offboarding.py) over the mock tables.
 */

const base = (path: string) => apiPath(`/offboarding${path}`)

const today = () => format(new Date(), 'yyyy-MM-dd')

/** 409 when the client's rowVersion is not the record's current one. */
function staleRecord(record: StoredEndOfEmployment, sent: string | null | undefined) {
  if (!sent) {
    return invalid('rowVersion is required to edit an end of employment.', {
      rowVersion: 'Required',
    })
  }
  if (sent !== versionOf(record)) {
    return conflict('Someone else changed this end of employment. Reload it and try again')
  }
  return null
}

const missing = (value: ChecklistAnswerValue | undefined) =>
  value === null || value === undefined || value === ''

/** What keeps a pending record from completing (sep.fn_end_of_employment_waiting). */
function waitingFor(record: StoredEndOfEmployment): WaitingItem[] {
  if (record.status !== 'pending') return []
  const waiting: WaitingItem[] = []
  if (record.finalSettlement) {
    const settlement = record.finalSettlementId
      ? finalSettlements.find(record.finalSettlementId)
      : undefined
    if (settlement?.status !== 'completed') {
      waiting.push({ item: 'final_settlement', label: 'Final settlement to be closed' })
    }
  }
  if (record.assetClearance) {
    const approved = clearances
      .all()
      .some((form) => form.endOfEmploymentId === record.id && form.status === 'approved')
    if (!approved) {
      waiting.push({ item: 'asset_clearance', label: 'Asset clearance to be approved' })
    }
    const holds = allocations
      .all()
      .some((item) => item.employeeId === record.employeeId && item.deallocatedOn === null)
    if (holds) waiting.push({ item: 'assets', label: 'Assets still allocated to the employee' })
  }
  const unanswered = activeChecklistFields().some(
    (field) => field.isRequired && missing(record.checklist[field.id]),
  )
  if (unanswered) waiting.push({ item: 'checklist', label: 'Required checklist answers' })
  if ((record.lastWorkingDate ?? today()) > today()) {
    waiting.push({ item: 'last_working_date', label: 'Last working date not reached' })
  }
  return waiting
}

/** Completes a pending record once nothing is waiting (as the backend does after each change). */
function refreshed(record: StoredEndOfEmployment): StoredEndOfEmployment {
  if (record.status !== 'pending' || waitingFor(record).length > 0) return record
  const next: StoredEndOfEmployment = {
    ...record,
    status: 'completed',
    completedAt: now(),
    rowVersion: nextVersion(),
  }
  endOfEmployments.update(record.id, next)
  return next
}

const lastDay = (record: StoredEndOfEmployment) =>
  record.lastWorkingDate ?? record.createdAt.slice(0, 10)

function rowOf(record: StoredEndOfEmployment): EndOfEmploymentRow {
  const person = personOf(record.employeeId)
  return {
    id: record.id,
    employeeId: record.employeeId,
    employeeCode: person?.code ?? null,
    employeeName: person?.name ?? null,
    branchName: person?.branchName ?? null,
    locationName: person?.locationName ?? null,
    departmentName: person?.departmentName ?? null,
    designationName: person?.designationName ?? null,
    reason: record.reason,
    serveNotice: record.noticePeriod,
    lastWorkingDate: lastDay(record),
    status: record.status,
    completedAt: record.completedAt,
    isRehired: record.rehire !== null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt ?? null,
    rowVersion: versionOf(record),
  }
}

const answerText = (value: ChecklistAnswerValue | undefined) =>
  value === null || value === undefined || value === '' ? null : String(value)

function detailOf(record: StoredEndOfEmployment): EndOfEmployment {
  const person = personOf(record.employeeId)
  const settlement = record.finalSettlementId
    ? finalSettlements.find(record.finalSettlementId)
    : undefined
  const form = record.clearanceId ? clearances.find(record.clearanceId) : undefined
  const fieldsById = new Map<string, ActiveChecklistField>(
    checklists
      .all()
      .flatMap((list) =>
        list.fields.map((field) => [
          field.id,
          { ...field, offboardingChecklistId: list.id, checklistName: list.name },
        ]),
      ),
  )
  return {
    ...rowOf(record),
    employeeEmail: person?.email ?? null,
    employeePhone: person?.phone ?? null,
    dateOfBirth: person?.dateOfBirth ?? null,
    photoFileId: null,
    photoUrl: person?.photoUrl ?? null,
    joiningDate: person?.joiningDate ?? null,
    resignationRequestId: record.resignationRequestId ?? null,
    noticePeriodDays: record.noticePeriodDays ?? null,
    needsFinalSettlement: record.finalSettlement,
    needsAssetClearance: record.assetClearance,
    assetClearByDate: record.assetClearByDate ?? null,
    replacementId: record.replacementId ?? null,
    replacementName: record.replacementId ? (personOf(record.replacementId)?.name ?? null) : null,
    delegateeId: record.delegateeId,
    delegateeName: record.delegateeId ? (personOf(record.delegateeId)?.name ?? null) : null,
    description: record.description || null,
    fileId: record.fileId ?? null,
    file: fileRef(record.fileId ?? null, record.fileId ? null : record.attachmentName),
    finalSettlementId: record.finalSettlementId,
    finalSettlementStatus: settlement
      ? settlement.status === 'completed'
        ? 'closed'
        : 'pending'
      : null,
    clearanceId: record.clearanceId,
    clearanceStatus: form?.status ?? null,
    rehireJoiningDate: record.rehire?.joiningDate ?? null,
    answers: Object.entries(record.checklist).flatMap(([fieldId, value]) => {
      const field = fieldsById.get(fieldId)
      if (!field || answerText(value) === null) return []
      return [
        {
          checklistFieldId: fieldId,
          fieldName: field.name,
          fieldType: field.fieldType,
          checklistId: field.offboardingChecklistId,
          checklistName: field.checklistName,
          answer: answerText(value),
        },
      ]
    }),
    waitingFor: waitingFor(record),
  }
}

/** Ticking Final Settlement makes (or keeps up to date) the person's pending Payroll settlement. */
function syncSettlement(record: StoredEndOfEmployment): StoredEndOfEmployment {
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
    lastWorkingDate: lastDay(record),
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

const recordSchema = z.object({
  employeeId: idSchema('Employee not found.'),
  reason: z.enum(EOE_REASONS, {
    error: 'Reason must be resignation, termination, retirement or other.',
  }),
  serveNotice: z.boolean().default(false),
  noticePeriodDays: z.number().int().min(0, 'Notice period cannot be negative.').nullish(),
  lastWorkingDate: day.nullish(),
  needsFinalSettlement: z.boolean().default(false),
  needsAssetClearance: z.boolean().default(false),
  assetClearByDate: day.nullish(),
  replacementId: optionalId,
  delegateeId: optionalId,
  description: optionalText(4000),
  fileId: fileIdSchema,
  rowVersion: z.string().nullish(),
})
type RecordBody = z.infer<typeof recordSchema>

function recordProblem(input: RecordBody, current?: StoredEndOfEmployment) {
  if (!personOf(input.employeeId)) {
    return invalid('Employee not found.', { employeeId: 'Employee not found.' })
  }
  if (current && current.employeeId !== input.employeeId) {
    const message = 'The employee of an end of employment cannot be changed.'
    return invalid(message, { employeeId: message })
  }
  if (input.serveNotice && !input.lastWorkingDate) {
    const message = 'Last working date is required with a notice period.'
    return invalid(message, { lastWorkingDate: message })
  }
  if (!current) {
    if (!isActive(input.employeeId)) {
      return conflict('This employee has already left.', 'EMPLOYEE_LEFT', 'employeeId')
    }
    const open = endOfEmployments
      .all()
      .some((item) => item.employeeId === input.employeeId && item.status === 'pending')
    if (open) {
      return conflict(
        'This employee already has a pending end of employment.',
        'END_OF_EMPLOYMENT_OPEN',
        'employeeId',
      )
    }
  }
  for (const key of ['replacementId', 'delegateeId'] as const) {
    const id = input[key]
    if (id && (id === input.employeeId || !personOf(id) || !isActive(id))) {
      const message = 'Choose another employee who is still working here.'
      return invalid(message, { [key]: message })
    }
  }
  return null
}

const toStored = (input: RecordBody) => ({
  reason: input.reason,
  noticePeriod: input.serveNotice,
  noticePeriodDays: input.serveNotice ? (input.noticePeriodDays ?? null) : null,
  finalSettlement: input.needsFinalSettlement,
  assetClearance: input.needsAssetClearance,
  assetClearByDate: input.needsAssetClearance ? (input.assetClearByDate ?? null) : null,
  replacementId: input.replacementId,
  delegateeId: input.delegateeId,
  description: input.description ?? '',
  fileId: input.fileId,
})

const answersSchema = z.object({
  answers: z.array(
    z.object({
      checklistFieldId: idSchema('Choose the field'),
      answer: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
    }),
  ),
  rowVersion: z.string().nullish(),
})

/** The backend's answer checks: active field, valid for its type, within its range. */
function answerProblem(fieldId: string, value: ChecklistAnswerValue) {
  const field = activeChecklistFields().find((item) => item.id === fieldId)
  const key = `answers.${fieldId}`
  if (!field) {
    return invalid('Answers are not valid.', {
      [key]: 'This field is not on an active off-boarding checklist.',
    })
  }
  if (missing(value)) return null
  const text = String(value)
  const bad = () =>
    invalid('Answers are not valid.', { [key]: `This answer is not a valid ${field.fieldType}.` })
  if (field.fieldType === 'number') {
    const number = Number(text)
    if (!Number.isFinite(number)) return bad()
    if (
      (field.minValue !== null && number < field.minValue) ||
      (field.maxValue !== null && number > field.maxValue)
    ) {
      return invalid('Answers are not valid.', {
        [key]: `The value must be between ${field.minValue === null ? 'any' : String(field.minValue)} and ${field.maxValue === null ? 'any' : String(field.maxValue)}.`,
      })
    }
  }
  if (field.fieldType === 'string') {
    if (
      (field.minLength !== null && text.length < field.minLength) ||
      (field.maxLength !== null && text.length > field.maxLength)
    ) {
      return invalid('Answers are not valid.', {
        [key]: `The text must be ${String(field.minLength ?? 0)} to ${field.maxLength === null ? 'any' : String(field.maxLength)} characters long.`,
      })
    }
  }
  if (field.fieldType === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(text)) return bad()
  if (field.fieldType === 'boolean' && text !== 'true' && text !== 'false') return bad()
  return null
}

const completedRefusal = () =>
  conflict(
    'A completed end of employment cannot be changed.',
    'END_OF_EMPLOYMENT_COMPLETED',
    'status',
  )

const recordHandlers = [
  http.get(base('/end-of-employment'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const wanted = {
      status: param(url, 'status'),
      employeeId: param(url, 'employeeId'),
      departmentId: param(url, 'departmentId'),
      branchId: param(url, 'branchId'),
      locationId: param(url, 'locationId'),
      designationId: param(url, 'designationId'),
      serveNotice: param(url, 'serveNotice'),
      from: param(url, 'from'),
      to: param(url, 'to'),
    }
    const list = endOfEmployments
      .all()
      .map(refreshed)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((record) => {
        const person = personOf(record.employeeId)
        const row = rowOf(record)
        const designation = wanted.designationId
          ? (jobTitles.find(wanted.designationId)?.name ?? null)
          : null
        return (
          matches(url, row.employeeName, row.employeeCode) &&
          (!wanted.status || record.status === wanted.status) &&
          (!wanted.employeeId || record.employeeId === wanted.employeeId) &&
          (!wanted.branchId || person?.branchId === wanted.branchId) &&
          (!wanted.locationId || person?.locationId === wanted.locationId) &&
          (!wanted.departmentId || sameUnit(wanted.departmentId, row.departmentName)) &&
          (!wanted.designationId ||
            designation === row.designationName ||
            sameUnit(wanted.designationId, row.designationName)) &&
          (!wanted.serveNotice || String(record.noticePeriod) === wanted.serveNotice) &&
          (!wanted.from || row.lastWorkingDate >= wanted.from) &&
          (!wanted.to || row.lastWorkingDate <= wanted.to)
        )
      })
      .map(rowOf)
    return page(url, list)
  }),
  http.get(base('/end-of-employment/checklist-fields'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    return ok<ActiveChecklistField[]>(activeChecklistFields())
  }),
  http.get(base('/end-of-employment/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const record = endOfEmployments.find(String(params.id))
    return record ? ok(detailOf(refreshed(record))) : notFound('End of employment')
  }),
  http.post(base('/end-of-employment'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, recordSchema)
    if (!parsed.success) return rejected(parsed.error)
    const problem = recordProblem(parsed.data)
    if (problem) return problem
    const input = parsed.data
    const record: StoredEndOfEmployment = {
      id: createId('eoe'),
      employeeId: input.employeeId,
      ...toStored(input),
      lastWorkingDate: input.serveNotice ? (input.lastWorkingDate ?? today()) : today(),
      attachmentName: null,
      checklist: {},
      status: 'pending',
      createdAt: now(),
      completedAt: null,
      finalSettlementId: null,
      clearanceId: null,
      rehire: null,
      resignationRequestId: null,
      updatedAt: null,
      rowVersion: nextVersion(),
    }
    const synced = syncSettlement(record)
    endOfEmployments.insert(synced)
    return created(detailOf(refreshed(synced)))
  }),
  http.put(base('/end-of-employment/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const existing = endOfEmployments.find(String(params.id))
    if (!existing) return notFound('End of employment')
    const parsed = await readBody(request, recordSchema)
    if (!parsed.success) return rejected(parsed.error)
    const old = staleRecord(existing, parsed.data.rowVersion)
    if (old) return old
    if (existing.status === 'completed') return completedRefusal()
    const problem = recordProblem(parsed.data, existing)
    if (problem) return problem
    const settlement = existing.finalSettlementId
      ? finalSettlements.find(existing.finalSettlementId)
      : undefined
    if (!parsed.data.needsFinalSettlement && settlement?.status === 'completed') {
      return conflict(
        'Payroll has started the final settlement; it cannot be dropped.',
        'CONFLICT',
        'needsFinalSettlement',
      )
    }
    const next = syncSettlement({
      ...existing,
      ...toStored(parsed.data),
      lastWorkingDate: parsed.data.serveNotice
        ? (parsed.data.lastWorkingDate ?? lastDay(existing))
        : existing.createdAt.slice(0, 10),
      updatedAt: now(),
      rowVersion: nextVersion(),
    })
    endOfEmployments.update(existing.id, next)
    return ok(detailOf(refreshed(next)))
  }),
  http.put(base('/end-of-employment/:id/checklist'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const existing = endOfEmployments.find(String(params.id))
    if (!existing) return notFound('End of employment')
    const parsed = await readBody(request, answersSchema)
    if (!parsed.success) return rejected(parsed.error)
    const old = staleRecord(existing, parsed.data.rowVersion)
    if (old) return old
    if (existing.status === 'completed') return completedRefusal()
    const checklist = { ...existing.checklist }
    for (const { checklistFieldId, answer = null } of parsed.data.answers) {
      const problem = answerProblem(checklistFieldId, answer)
      if (problem) return problem
      checklist[checklistFieldId] = missing(answer) ? null : answer
    }
    const next = { ...existing, checklist, updatedAt: now(), rowVersion: nextVersion() }
    endOfEmployments.update(existing.id, next)
    return ok(detailOf(refreshed(next)))
  }),
  http.patch(base('/end-of-employment/:id/complete'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const existing = endOfEmployments.find(String(params.id))
    if (!existing) return notFound('End of employment')
    const parsed = await readBody(request, z.object({ rowVersion: z.string().nullish() }))
    if (!parsed.success) return rejected(parsed.error)
    const old = staleRecord(existing, parsed.data.rowVersion)
    if (old) return old
    if (existing.status === 'completed') {
      return conflict(
        'This end of employment is already completed.',
        'END_OF_EMPLOYMENT_COMPLETED',
        'status',
      )
    }
    const waiting = waitingFor(existing)
    if (waiting.length > 0) {
      return conflict(
        `Waiting for: ${waiting.map((item) => item.label).join(', ')}.`,
        'END_OF_EMPLOYMENT_WAITING',
        'status',
      )
    }
    return ok(detailOf(refreshed(existing)))
  }),
  http.patch(base('/end-of-employment/:id/rehire'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const record = endOfEmployments.find(String(params.id))
    if (!record) return notFound('End of employment')
    const parsed = await readBody(
      request,
      z.object({ joiningDate: day, rowVersion: z.string().nullish() }),
    )
    if (!parsed.success) return rejected(parsed.error)
    const old = staleRecord(record, parsed.data.rowVersion)
    if (old) return old
    if (record.status !== 'completed') {
      return conflict(
        'Only a completed end of employment can be rehired.',
        'END_OF_EMPLOYMENT_PENDING',
        'status',
      )
    }
    if (record.rehire) {
      return conflict('This employee has been rehired since.', 'ALREADY_REHIRED', 'employeeId')
    }
    if (parsed.data.joiningDate <= lastDay(record)) {
      const message = 'The joining date must be after the last working date.'
      return invalid(message, { joiningDate: message })
    }
    const next: StoredEndOfEmployment = {
      ...record,
      rehire: { joiningDate: parsed.data.joiningDate, at: now() },
      updatedAt: now(),
      rowVersion: nextVersion(),
    }
    endOfEmployments.update(record.id, next)
    return ok(detailOf(next))
  }),
  http.delete(base('/end-of-employment/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const record = endOfEmployments.find(String(params.id))
    if (!record) return notFound('End of employment')
    const old = staleRecord(record, new URL(request.url).searchParams.get('rowVersion'))
    if (old) return old
    if (record.status === 'completed') {
      return conflict(
        'A completed end of employment cannot be deleted.',
        'END_OF_EMPLOYMENT_COMPLETED',
        'status',
      )
    }
    const form = record.clearanceId ? clearances.find(record.clearanceId) : undefined
    if (form?.status === 'approved') {
      return conflict('Its asset clearance is approved. Unapprove the clearance first.')
    }
    if (form) clearances.update(form.id, { ...form, endOfEmploymentId: null })
    syncSettlement({ ...record, finalSettlement: false })
    endOfEmployments.remove(record.id)
    return noContent()
  }),
]

// --- Settings → Off Boarding Checklist ------------------------------------------------------------

const fieldSchema = z
  .object({
    id: optionalId,
    name: z.string().trim().min(1, 'Enter the name').max(200),
    fieldType: z.enum(CHECKLIST_FIELD_TYPES, { error: 'Choose the type' }),
    isRequired: z.boolean().default(false),
    minValue: z.number().nullish(),
    maxValue: z.number().nullish(),
    minLength: z.number().int().min(0).nullish(),
    maxLength: z.number().int().min(0).nullish(),
  })
  .refine(
    (value) =>
      (value.minValue ?? -Infinity) <= (value.maxValue ?? Infinity) &&
      (value.minLength ?? 0) <= (value.maxLength ?? Infinity),
    { message: 'Fields are not valid.', path: ['fields'] },
  )

const checklistSchema = z
  .object({
    name: z.string().trim().min(1, 'Checklist name is required.').max(200),
    description: optionalText(4000),
    isActive: z.boolean().default(true),
    fields: z.array(fieldSchema).max(100).default([]),
    rowVersion: z.string().nullish(),
  })
  .refine(
    (value) =>
      new Set(value.fields.map((field) => field.name.toLowerCase())).size === value.fields.length,
    { message: 'Fields are not valid.', path: ['fields'] },
  )
type ChecklistBody = z.infer<typeof checklistSchema>

const toFields = (fields: ChecklistBody['fields'], existing: readonly ChecklistField[]) =>
  fields.map((field, index): ChecklistField => ({
    id: field.id && existing.some((item) => item.id === field.id) ? field.id : createId('cf'),
    name: field.name,
    fieldType: field.fieldType,
    isRequired: field.isRequired,
    // Only numbers have a value range, only strings a length range.
    minValue: field.fieldType === 'number' ? (field.minValue ?? null) : null,
    maxValue: field.fieldType === 'number' ? (field.maxValue ?? null) : null,
    minLength: field.fieldType === 'string' ? (field.minLength ?? null) : null,
    maxLength: field.fieldType === 'string' ? (field.maxLength ?? null) : null,
    sortOrder: index,
  }))

const checklistOut = (item: StoredChecklist, withFields: boolean): OffboardingChecklist => ({
  ...item,
  fieldCount: item.fields.length,
  fields: withFields ? item.fields : [],
})

const nameTaken = (name: string, id?: string) =>
  checklists.all().some((item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase())

const DUPLICATE = 'A checklist with this name already exists.'

/** A field with answers on some end of employment. */
const answered = (fieldId: string) =>
  endOfEmployments.all().some((record) => !missing(record.checklist[fieldId]))

function staleChecklist(item: StoredChecklist, sent: string | null | undefined) {
  if (!sent)
    return invalid('rowVersion is required to edit a checklist.', { rowVersion: 'Required' })
  if (sent !== item.rowVersion) {
    return conflict('Someone else changed this checklist. Reload it and try again')
  }
  return null
}

const checklistHandlers = [
  http.get(base('/settings/checklists'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const active = param(url, 'isActive')
    const list = checklists
      .all()
      .filter(
        (item) =>
          matches(url, item.name, item.code) &&
          (active === undefined || String(item.isActive) === active),
      )
      .sort((a, b) => a.code.localeCompare(b.code))
    return page(
      url,
      list.map((item) => checklistOut(item, false)),
    )
  }),
  http.get(base('/settings/checklists/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const item = checklists.find(String(params.id))
    return item ? ok(checklistOut(item, true)) : notFound('Checklist')
  }),
  http.post(base('/settings/checklists'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, checklistSchema)
    if (!parsed.success) return rejected(parsed.error)
    if (nameTaken(parsed.data.name)) return conflict(DUPLICATE, 'CHECKLIST_DUPLICATE', 'name')
    const item: StoredChecklist = {
      id: createId('ecl'),
      code: nextCode(
        'ECL-',
        checklists.all().map((entry) => entry.code),
      ),
      name: parsed.data.name,
      description: parsed.data.description,
      isActive: parsed.data.isActive,
      fields: toFields(parsed.data.fields, []),
      createdAt: now(),
      updatedAt: null,
      rowVersion: nextVersion(),
    }
    checklists.insert(item)
    return created(checklistOut(item, true))
  }),
  http.put(base('/settings/checklists/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const existing = checklists.find(String(params.id))
    if (!existing) return notFound('Checklist')
    const parsed = await readBody(request, checklistSchema)
    if (!parsed.success) return rejected(parsed.error)
    const old = staleChecklist(existing, parsed.data.rowVersion)
    if (old) return old
    if (nameTaken(parsed.data.name, existing.id)) {
      return conflict(DUPLICATE, 'CHECKLIST_DUPLICATE', 'name')
    }
    const fields = toFields(parsed.data.fields, existing.fields)
    const removed = existing.fields.filter((field) => !fields.some((item) => item.id === field.id))
    if (removed.some((field) => answered(field.id))) {
      return conflict(
        'A removed field has answers on an end of employment. Keep it, or deactivate the checklist.',
        'CHECKLIST_FIELD_IN_USE',
        'fields',
      )
    }
    const item: StoredChecklist = {
      ...existing,
      name: parsed.data.name,
      description: parsed.data.description,
      isActive: parsed.data.isActive,
      fields,
      updatedAt: now(),
      rowVersion: nextVersion(),
    }
    checklists.update(existing.id, item)
    return ok(checklistOut(item, true))
  }),
  http.delete(base('/settings/checklists/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const item = checklists.find(String(params.id))
    if (!item) return notFound('Checklist')
    const old = staleChecklist(item, new URL(request.url).searchParams.get('rowVersion'))
    if (old) return old
    if (item.fields.some((field) => answered(field.id))) {
      return conflict(
        'This checklist has answers on an end of employment. Deactivate it instead.',
        'CHECKLIST_IN_USE',
      )
    }
    checklists.remove(item.id)
    return noContent()
  }),
]

export const offboardingHandlers = [...recordHandlers, ...checklistHandlers]
