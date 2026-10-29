import { format, isValid, parse } from 'date-fns'
import { http, type HttpHandler, HttpResponse } from 'msw'
import { z } from 'zod'

import type {
  AnswerDto,
  AssignedFormDetailDto,
  AssignedFormDto,
  AudienceDto,
  FormDto,
  FormFieldDto,
  FormSectionDto,
  FormSummaryDto,
  MyResponseDto,
  ResponseDetailDto,
  ResponseDto,
  ResponseSummaryDto,
} from '@/features/custom-forms'
import { AUDIENCE_KINDS, FIELD_TYPES } from '@/features/custom-forms'
import type { ApiItem, Paginated } from '@/types/api'

import { DEMO_USER } from '../auth/handlers'
import { createMockCollection } from '../collection'
import { DIRECTORY, findEmployee } from '../employees/seed'
import { mockFileUrl, mockUploadName } from '../files/handlers'
import { departmentId } from '../payroll/lookup-handlers'
import { employeeRef } from '../payroll/people'
import { branches } from '../settings/handlers'
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
  type AnswerRec,
  type FieldRec,
  type FormRec,
  nextRowVersion,
  type ResponseRec,
  type SectionRec,
  seedForms,
  seedResponses,
} from './seed'

/*
 * The mock of `/api/forms…` (Custom Form), which the backend does not have yet (Backend
 * Dependencies, "Custom Form"). It answers the endpoints the screens are built against:
 *   GET/POST /forms, GET/PUT/DELETE /forms/{id}, POST /forms/{id}/publish | close | duplicate,
 *   GET /forms/assigned, GET /forms/assigned/{id}, GET/POST /forms/{id}/responses,
 *   GET /forms/{id}/responses/summary, GET /forms/responses/{id}, GET /forms/my-responses.
 * It validates as the API would (422 with `fieldErrors`), answers 409 for a stale `rowVersion`
 * and for the status rules (no answers to a draft or closed form, one response per person when
 * set, locked fields once a form has answers), and 404 for unknown records.
 * The caller is the demo user (Shelley Kannes, `em_shelley`).
 */

export const customForms = createMockCollection<FormRec>({
  storageKey: 'mock-custom-forms',
  seed: seedForms,
})
export const customFormResponses = createMockCollection<ResponseRec>({
  storageKey: 'mock-custom-form-responses',
  seed: seedResponses,
})

/** Restores the module's mock tables to their seed data (used between tests). */
export function resetCustomFormsDb(): void {
  customForms.reset()
  customFormResponses.reset()
}

// --- helpers -------------------------------------------------------------------------------------

const base = (path = '') => apiPath(`/forms${path}`)
const now = () => new Date().toISOString()
const today = () => format(new Date(), 'yyyy-MM-dd')
const callerId = () => DEMO_USER.employeeId ?? 'em_shelley'

async function guard(request: Request): Promise<Response | null> {
  await latency()
  return requireAuth(request)
}

async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => null)
}

const notFound = (what = 'Form') => errorResponse(404, `${what} not found.`, { code: 'NOT_FOUND' })

function invalid(
  fieldErrors: Record<string, string>,
  message = 'Some fields need your attention.',
) {
  return errorResponse(422, message, { code: 'VALIDATION_FAILED', fieldErrors })
}

/** 422 in the API's shape: one message per field path (`fields.2.label`), the first issue on it. */
function validationFailed(issues: readonly z.core.$ZodIssue[]): Response {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const path = issue.path.map(String).join('.') || 'body'
    if (!(path in fieldErrors)) fieldErrors[path] = issue.message
  }
  return invalid(fieldErrors)
}

/** Missing → 422; stale → 409; `null` when it is the current version. */
function checkRowVersion(given: unknown, current: FormRec): Response | null {
  if (typeof given !== 'string' || given === '') {
    return invalid({ rowVersion: 'rowVersion is required.' })
  }
  if (given !== current.rowVersion) {
    return errorResponse(
      409,
      'Someone else changed this form since you opened it. Reload it and try again.',
      { code: 'STALE_ROW_VERSION' },
    )
  }
  return null
}

const isDay = (value: string) => isValid(parse(value, 'yyyy-MM-dd', new Date()))

/** Published forms whose closing date has passed read as closed. */
function statusOf(form: FormRec): FormRec['status'] {
  if (form.status === 'published' && form.closesOn !== null && form.closesOn < today()) {
    return 'closed'
  }
  return form.status
}

const responsesOf = (formId: string) =>
  customFormResponses
    .all()
    .filter((response) => response.formId === formId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))

const DEPARTMENTS = [...new Set(DIRECTORY.map((person) => person.department))]
  .sort()
  .map((name) => ({ id: departmentId(name), name }))

function targetName(kind: FormRec['audience']['kind'], id: string): string | null {
  if (kind === 'departments') return DEPARTMENTS.find((item) => item.id === id)?.name ?? null
  if (kind === 'branches') return branches.find(id)?.name ?? null
  if (kind === 'people') return findEmployee(id)?.name ?? null
  return null
}

function audienceDto(form: FormRec): AudienceDto {
  return {
    kind: form.audience.kind,
    targets: form.audience.ids.map((id) => ({
      id,
      name: targetName(form.audience.kind, id) ?? id,
    })),
  }
}

/** Is a person in the form's audience? */
function reaches(form: FormRec, employeeId: string): boolean {
  const person = findEmployee(employeeId)
  if (!person) return false
  switch (form.audience.kind) {
    case 'everyone':
      return true
    case 'departments':
      return form.audience.ids.includes(departmentId(person.department))
    case 'branches':
      return person.branchId !== null && form.audience.ids.includes(person.branchId)
    case 'people':
      return form.audience.ids.includes(employeeId)
  }
}

function sectionsDto(form: FormRec): FormSectionDto[] {
  return form.sections.map((section, position) => ({ ...section, position }))
}

function fieldsDto(form: FormRec): FormFieldDto[] {
  const positions = new Map<string | null, number>()
  return form.fields.map((field) => {
    const position = positions.get(field.sectionId) ?? 0
    positions.set(field.sectionId, position + 1)
    return { ...field, options: field.options.map((option) => ({ ...option })), position }
  })
}

function summaryDto(form: FormRec): FormSummaryDto {
  return {
    id: form.id,
    title: form.title,
    description: form.description,
    category: form.category,
    status: statusOf(form),
    closesOn: form.closesOn,
    audience: audienceDto(form),
    fieldCount: form.fields.length,
    responseCount: responsesOf(form.id).length,
    anonymous: form.anonymous,
    updatedAt: form.updatedAt,
    publishedAt: form.publishedAt,
    rowVersion: form.rowVersion,
  }
}

function formDto(form: FormRec): FormDto {
  const author = findEmployee(form.createdById)
  return {
    ...summaryDto(form),
    oneResponsePerPerson: form.oneResponsePerPerson,
    sections: sectionsDto(form),
    fields: fieldsDto(form),
    createdBy: author ? { id: author.id, name: author.name } : null,
    createdAt: form.createdAt,
    closedAt: form.closedAt,
  }
}

function assignedDto(form: FormRec, employeeId: string): AssignedFormDto {
  const mine = responsesOf(form.id).filter((response) => response.employeeId === employeeId)
  const status = statusOf(form)
  return {
    id: form.id,
    title: form.title,
    description: form.description,
    category: form.category,
    status,
    closesOn: form.closesOn,
    fieldCount: form.fields.length,
    oneResponsePerPerson: form.oneResponsePerPerson,
    anonymous: form.anonymous,
    myResponseCount: mine.length,
    lastResponseId: mine[0]?.id ?? null,
    lastSubmittedAt: mine[0]?.submittedAt ?? null,
    canRespond: status === 'published' && (!form.oneResponsePerPerson || mine.length === 0),
  }
}

function answerDto(field: FieldRec | undefined, answer: AnswerRec): AnswerDto {
  const fileId = field?.type === 'file' && typeof answer.value === 'string' ? answer.value : null
  return {
    fieldId: answer.fieldId,
    value: answer.value,
    file: fileId ? { id: fileId, name: mockUploadName(fileId), url: mockFileUrl(fileId) } : null,
  }
}

function responseDto(response: ResponseRec, form: FormRec): ResponseDto {
  const person = employeeRef(response.employeeId)
  const fields = new Map(form.fields.map((field) => [field.id, field]))
  return {
    id: response.id,
    formId: response.formId,
    respondent: form.anonymous
      ? null
      : {
          id: response.employeeId,
          name: person.name,
          code: person.code || null,
          departmentName: person.department || null,
        },
    submittedAt: response.submittedAt,
    answers: response.answers.map((answer) => answerDto(fields.get(answer.fieldId), answer)),
  }
}

function okItem<T>(data: T, status = 200) {
  return HttpResponse.json<ApiItem<T>>({ data }, { status })
}

function okPage<T>(rows: readonly T[], url: URL) {
  const { page, pageSize } = readPageParams(url)
  return HttpResponse.json<Paginated<T>>(paginate(rows, page, pageSize))
}

const matches = (q: string, ...texts: (string | null)[]) =>
  !q || texts.some((text) => (text ?? '').toLowerCase().includes(q))

// --- the form body (`FormIn`) -----------------------------------------------------------------

const idIn = z.union([z.number().int(), z.string().min(1)]).transform(String)
const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} may be at most ${String(max)} characters.`)
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `At most ${String(max)} characters.`)
    .nullable()
    .optional()
    .transform((value) => (value === undefined || value === null || value === '' ? null : value))

const formBody = z.object({
  title: requiredText('Title', 150),
  description: optionalText(2000),
  category: optionalText(60),
  closesOn: z
    .string()
    .refine(isDay, 'Use a date as yyyy-MM-dd.')
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  audience: z.object({
    kind: z.enum(AUDIENCE_KINDS, { error: 'Choose who the form is for.' }),
    ids: z.array(idIn).max(500).default([]),
  }),
  oneResponsePerPerson: z.boolean().default(false),
  anonymous: z.boolean().default(false),
  sections: z
    .array(
      z.object({
        key: z.string().min(1),
        id: idIn.nullable().optional(),
        title: requiredText('Section title', 150),
        description: optionalText(500),
      }),
    )
    .max(30, 'At most 30 sections.')
    .default([]),
  fields: z
    .array(
      z.object({
        id: idIn.nullable().optional(),
        sectionKey: z.string().nullable().optional(),
        type: z.enum(FIELD_TYPES, { error: 'Choose a field type.' }),
        label: requiredText('Label', 200),
        helpText: optionalText(500),
        required: z.boolean().default(false),
        options: z
          .array(
            z.object({
              id: idIn.nullable().optional(),
              label: z.string().trim().min(1, 'Enter the option.').max(120),
            }),
          )
          .max(30, 'At most 30 options.')
          .default([]),
        min: z.number().nullable().optional(),
        max: z.number().nullable().optional(),
      }),
    )
    .max(100, 'At most 100 fields.')
    .default([]),
  rowVersion: z.unknown().optional(),
})
type FormBody = z.infer<typeof formBody>

const CHOICES = new Set(['single_choice', 'multiple_choice', 'dropdown'])
const LENGTHS = new Set(['short_text', 'long_text'])

/** The rules beyond the shape: options, limits, sections and the audience. */
function checkBody(body: FormBody): Record<string, string> {
  const errors: Record<string, string> = {}
  const sectionKeys = new Set<string>()
  body.sections.forEach((section, index) => {
    if (sectionKeys.has(section.key)) errors[`sections.${String(index)}.key`] = 'Duplicate key.'
    sectionKeys.add(section.key)
  })
  body.fields.forEach((field, index) => {
    const at = (name: string) => `fields.${String(index)}.${name}`
    const { min = null, max = null } = field
    if (field.sectionKey && !sectionKeys.has(field.sectionKey)) {
      errors[at('sectionKey')] = 'No such section.'
    }
    if (CHOICES.has(field.type)) {
      if (field.options.length < 2) errors[at('options')] = 'Add at least two options.'
      const labels = field.options.map((option) => option.label.toLowerCase())
      if (new Set(labels).size !== labels.length) errors[at('options')] = 'Options must differ.'
    }
    if (
      field.type === 'rating' &&
      (max === null || !Number.isInteger(max) || max < 3 || max > 10)
    ) {
      errors[at('max')] = 'The scale is 3 to 10.'
    }
    if (LENGTHS.has(field.type) || field.type === 'multiple_choice') {
      if (min !== null && (!Number.isInteger(min) || min < 0)) errors[at('min')] = 'Use 0 or more.'
      if (max !== null && (!Number.isInteger(max) || max < 1)) errors[at('max')] = 'Use 1 or more.'
    }
    if (field.type === 'multiple_choice' && max !== null && max > field.options.length) {
      errors[at('max')] = 'More picks than options.'
    }
    if (min !== null && max !== null && min > max && !(at('max') in errors)) {
      errors[at('max')] = 'Max must not be below min.'
    }
  })
  const { kind, ids } = body.audience
  if (kind !== 'everyone') {
    if (ids.length === 0) errors['audience.ids'] = 'Choose at least one.'
    else if (ids.some((id) => targetName(kind, id) === null)) {
      errors['audience.ids'] = 'One of these no longer exists.'
    }
  }
  return errors
}

/**
 * A form with answers keeps what the answers point at: no field removed, no type changed, no
 * option removed, and the same anonymity. Returns the refusal, or `null`.
 */
function checkLocks(body: FormBody, current: FormRec): Response | null {
  if (responsesOf(current.id).length === 0) return null
  const errors: Record<string, string> = {}
  if (body.anonymous !== current.anonymous) {
    errors.anonymous = 'Anonymity cannot change once the form has responses.'
  }
  const kept = new Set(body.fields.map((field) => field.id).filter(Boolean))
  const removed = current.fields.filter((field) => !kept.has(field.id))
  body.fields.forEach((field, index) => {
    const before = current.fields.find((item) => item.id === field.id)
    if (!before) return
    if (before.type !== field.type) {
      errors[`fields.${String(index)}.type`] = 'The type cannot change once the form has responses.'
    }
    const options = new Set(field.options.map((option) => option.id).filter(Boolean))
    if (before.options.some((option) => !options.has(option.id))) {
      errors[`fields.${String(index)}.options`] = 'Options with answers cannot be removed.'
    }
  })
  if (removed.length > 0) {
    return errorResponse(
      409,
      `This form has responses, so its questions cannot be removed (${removed.map((field) => field.label).join(', ')}).`,
      { code: 'FORM_HAS_RESPONSES' },
    )
  }
  return Object.keys(errors).length > 0
    ? invalid(errors, 'This form has responses, so some changes are not allowed.')
    : null
}

/** The body as stored: ids kept for existing sections, fields and options, new ones made. */
function writeForm(body: FormBody, current: FormRec | undefined) {
  const sectionIds = new Map<string, string>()
  const sections: SectionRec[] = body.sections.map((section) => {
    const known = current?.sections.find((item) => item.id === section.id)
    const id = known?.id ?? createId('cfs')
    sectionIds.set(section.key, id)
    return { id, title: section.title, description: section.description }
  })
  const fields: FieldRec[] = body.fields.map((field) => {
    const known = current?.fields.find((item) => item.id === field.id)
    const choice = CHOICES.has(field.type)
    // Lengths (text), values (number) and picks (multiple choice) take both; a rating its scale.
    const usesMin =
      LENGTHS.has(field.type) || field.type === 'number' || field.type === 'multiple_choice'
    const usesMax = usesMin || field.type === 'rating'
    return {
      id: known?.id ?? createId('cff'),
      sectionId: field.sectionKey ? (sectionIds.get(field.sectionKey) ?? null) : null,
      type: field.type,
      label: field.label,
      helpText: field.helpText,
      required: field.required,
      options: choice
        ? field.options.map((option) => ({
            id: known?.options.find((item) => item.id === option.id)?.id ?? createId('cfo'),
            label: option.label,
          }))
        : [],
      min: usesMin ? (field.min ?? null) : null,
      max: usesMax ? (field.max ?? null) : null,
    }
  })
  // Sections hold their fields together: those before the first section, then each section's.
  const order = new Map<string | null, number>([[null, -1]])
  sections.forEach((section, index) => order.set(section.id, index))
  const sorted = fields
    .map((field, index) => ({ field, index }))
    .sort(
      (a, b) =>
        (order.get(a.field.sectionId) ?? 0) - (order.get(b.field.sectionId) ?? 0) ||
        a.index - b.index,
    )
    .map(({ field }) => field)
  return {
    title: body.title,
    description: body.description,
    category: body.category,
    closesOn: body.closesOn,
    audience: {
      kind: body.audience.kind,
      ids: body.audience.kind === 'everyone' ? [] : body.audience.ids,
    },
    oneResponsePerPerson: body.oneResponsePerPerson,
    anonymous: body.anonymous,
    sections,
    fields: sorted,
  }
}

/** Publishing needs a question and a closing date still ahead. */
function checkPublishable(form: FormRec): Response | null {
  if (form.fields.length === 0) {
    return invalid(
      { fields: 'Add at least one question before publishing.' },
      'Add at least one question before publishing.',
    )
  }
  if (form.closesOn !== null && form.closesOn < today()) {
    return invalid(
      { closesOn: 'The closing date has passed. Move it first.' },
      'The closing date has passed. Move it first.',
    )
  }
  return null
}

// --- answers --------------------------------------------------------------------------------------

const answersBody = z.object({
  answers: z
    .array(
      z.object({
        fieldId: idIn,
        value: z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.array(z.union([z.number(), z.string()]).transform(String)),
          z.null(),
        ]),
      }),
    )
    .max(200),
})

const isBlank = (value: AnswerRec['value']) =>
  value === null || value === '' || value === false || (Array.isArray(value) && value.length === 0)

/** One answer against its field: the stored value, or the message for `answers.<fieldId>`. */
function checkAnswer(
  field: FieldRec,
  raw: AnswerRec['value'] | undefined,
): { value: AnswerRec['value'] } | { error: string } {
  const value = raw ?? null
  if (isBlank(value)) {
    if (field.required) {
      return {
        error: field.type === 'checkbox' ? 'Tick this to go on.' : 'This question needs an answer.',
      }
    }
    return { value: field.type === 'checkbox' ? false : null }
  }
  const { min, max } = field
  switch (field.type) {
    case 'short_text':
    case 'long_text': {
      if (typeof value !== 'string') return { error: 'Enter text.' }
      const text = value.trim()
      if (min !== null && text.length < min) return { error: `At least ${String(min)} characters.` }
      if (text.length > (max ?? 5000))
        return { error: `At most ${String(max ?? 5000)} characters.` }
      return { value: text }
    }
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return { error: 'Enter a number.' }
      if (min !== null && value < min) return { error: `The lowest is ${String(min)}.` }
      if (max !== null && value > max) return { error: `The highest is ${String(max)}.` }
      return { value }
    }
    case 'date':
      return typeof value === 'string' && isDay(value) ? { value } : { error: 'Enter a date.' }
    case 'single_choice':
    case 'dropdown': {
      const id = typeof value === 'number' ? String(value) : value
      return typeof id === 'string' && field.options.some((option) => option.id === id)
        ? { value: id }
        : { error: 'Pick one of the options.' }
    }
    case 'multiple_choice': {
      if (!Array.isArray(value)) return { error: 'Pick from the options.' }
      const ids = [...new Set(value)]
      if (ids.some((id) => !field.options.some((option) => option.id === id))) {
        return { error: 'Pick from the options.' }
      }
      if (min !== null && ids.length < min) return { error: `Pick at least ${String(min)}.` }
      if (max !== null && ids.length > max) return { error: `Pick at most ${String(max)}.` }
      return { value: ids }
    }
    case 'checkbox':
      return typeof value === 'boolean' ? { value } : { error: 'Tick or leave it.' }
    case 'file': {
      const id = typeof value === 'number' ? String(value) : value
      return typeof id === 'string' && mockUploadName(id) !== null
        ? { value: id }
        : { error: 'Upload the file again.' }
    }
    case 'rating': {
      const scale = max ?? 5
      return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= scale
        ? { value }
        : { error: `Choose 1 to ${String(scale)}.` }
    }
  }
}

function summaryOf(form: FormRec): ResponseSummaryDto {
  const responses = responsesOf(form.id)
  const fields = form.fields
    .filter(
      (field) => CHOICES.has(field.type) || field.type === 'checkbox' || field.type === 'rating',
    )
    .map((field) => {
      const values =
        field.type === 'checkbox'
          ? ['true', 'false']
          : field.type === 'rating'
            ? Array.from({ length: field.max ?? 5 }, (_, index) => String(index + 1))
            : field.options.map((option) => option.id)
      const counts = new Map(values.map((value) => [value, 0]))
      let answered = 0
      for (const response of responses) {
        const answer = response.answers.find((item) => item.fieldId === field.id)?.value ?? null
        if (answer === null || (Array.isArray(answer) && answer.length === 0)) continue
        answered += 1
        const picked = Array.isArray(answer) ? answer : [String(answer)]
        for (const value of picked) {
          if (counts.has(value)) counts.set(value, (counts.get(value) ?? 0) + 1)
        }
      }
      return {
        fieldId: field.id,
        answered,
        counts: values.map((value) => ({ value, count: counts.get(value) ?? 0 })),
      }
    })
  return { total: responses.length, fields }
}

// --- handlers -------------------------------------------------------------------------------------

export const customFormHandlers: HttpHandler[] = [
  // Static paths before `/forms/:id`.
  http.get(base('/assigned'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const me = callerId()
    const rows = customForms
      .all()
      .filter((form) => form.status !== 'draft' && reaches(form, me))
      .filter((form) => matches(q, form.title, form.category, form.description))
      .map((form) => assignedDto(form, me))
      .sort(
        (a, b) =>
          Number(b.canRespond) - Number(a.canRespond) ||
          Number(a.status === 'closed') - Number(b.status === 'closed') ||
          a.title.localeCompare(b.title),
      )
    return okPage(rows, url)
  }),

  http.get(base('/assigned/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const form = customForms.find(String(params.id))
    if (!form || form.status === 'draft' || !reaches(form, callerId())) return notFound()
    return okItem<AssignedFormDetailDto>({
      ...assignedDto(form, callerId()),
      sections: sectionsDto(form),
      fields: fieldsDto(form),
    })
  }),

  http.get(base('/my-responses'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const rows = customFormResponses
      .all()
      .filter((response) => response.employeeId === callerId())
      .flatMap((response): MyResponseDto[] => {
        const form = customForms.find(response.formId)
        if (!form || !matches(q, form.title, form.category)) return []
        return [
          {
            id: response.id,
            formId: form.id,
            formTitle: form.title,
            category: form.category,
            anonymous: form.anonymous,
            submittedAt: response.submittedAt,
          },
        ]
      })
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    return okPage(rows, url)
  }),

  http.get(base('/responses/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const response = customFormResponses.find(String(params.id))
    const form = response ? customForms.find(response.formId) : undefined
    if (!response || !form) return notFound('Response')
    return okItem<ResponseDetailDto>({
      ...responseDto(response, form),
      form: {
        id: form.id,
        title: form.title,
        description: form.description,
        anonymous: form.anonymous,
        sections: sectionsDto(form),
        fields: fieldsDto(form),
      },
    })
  }),

  http.get(base(), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const status = url.searchParams.get('status')
    const rows = customForms
      .all()
      .filter((form) => !status || statusOf(form) === status)
      .filter((form) => matches(q, form.title, form.category, form.description))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(summaryDto)
    return okPage(rows, url)
  }),

  http.post(base(), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const parsed = formBody.safeParse(await readJson(request))
    if (!parsed.success) return validationFailed(parsed.error.issues)
    const errors = checkBody(parsed.data)
    if (Object.keys(errors).length > 0) return invalid(errors)
    const stamp = now()
    const form: FormRec = {
      id: createId('cf'),
      ...writeForm(parsed.data, undefined),
      status: 'draft',
      createdById: callerId(),
      createdAt: stamp,
      updatedAt: stamp,
      publishedAt: null,
      closedAt: null,
      rowVersion: nextRowVersion(),
    }
    customForms.insert(form)
    return okItem(formDto(form), 201)
  }),

  http.get(base('/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const form = customForms.find(String(params.id))
    return form ? okItem(formDto(form)) : notFound()
  }),

  http.put(base('/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const current = customForms.find(String(params.id))
    if (!current) return notFound()
    const parsed = formBody.safeParse(await readJson(request))
    if (!parsed.success) return validationFailed(parsed.error.issues)
    const stale = checkRowVersion(parsed.data.rowVersion, current)
    if (stale) return stale
    const errors = checkBody(parsed.data)
    if (Object.keys(errors).length > 0) return invalid(errors)
    const locked = checkLocks(parsed.data, current)
    if (locked) return locked
    const next: FormRec = {
      ...current,
      ...writeForm(parsed.data, current),
      updatedAt: now(),
      rowVersion: nextRowVersion(),
    }
    // Moving the closing date of a lapsed form ahead does not reopen it: Reopen does.
    if (statusOf(current) === 'closed' && current.status === 'published') {
      next.status = 'closed'
      next.closedAt = current.closedAt ?? now()
    }
    customForms.update(current.id, next)
    return okItem(formDto(next))
  }),

  http.delete(base('/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const current = customForms.find(String(params.id))
    if (!current) return notFound()
    const stale = checkRowVersion(new URL(request.url).searchParams.get('rowVersion'), current)
    if (stale) return stale
    const responses = responsesOf(current.id)
    if (statusOf(current) === 'published' && responses.length > 0) {
      return errorResponse(
        409,
        `This form is open and has ${String(responses.length)} responses. Close it before deleting it.`,
        { code: 'FORM_HAS_RESPONSES' },
      )
    }
    for (const response of responses) customFormResponses.remove(response.id)
    customForms.remove(current.id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(base('/:id/publish'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const current = customForms.find(String(params.id))
    if (!current) return notFound()
    const body = (await readJson(request)) as { rowVersion?: unknown } | null
    const stale = checkRowVersion(body?.rowVersion, current)
    if (stale) return stale
    if (statusOf(current) === 'published') {
      return errorResponse(409, 'This form is already published.', { code: 'FORM_PUBLISHED' })
    }
    const refused = checkPublishable(current)
    if (refused) return refused
    const stamp = now()
    const next: FormRec = {
      ...current,
      status: 'published',
      publishedAt: current.publishedAt ?? stamp,
      closedAt: null,
      updatedAt: stamp,
      rowVersion: nextRowVersion(),
    }
    customForms.update(current.id, next)
    return okItem(formDto(next))
  }),

  http.post(base('/:id/close'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const current = customForms.find(String(params.id))
    if (!current) return notFound()
    const body = (await readJson(request)) as { rowVersion?: unknown } | null
    const stale = checkRowVersion(body?.rowVersion, current)
    if (stale) return stale
    if (current.status !== 'published') {
      return errorResponse(409, 'Only a published form can be closed.', {
        code: 'FORM_NOT_PUBLISHED',
      })
    }
    const stamp = now()
    const next: FormRec = {
      ...current,
      status: 'closed',
      closedAt: stamp,
      updatedAt: stamp,
      rowVersion: nextRowVersion(),
    }
    customForms.update(current.id, next)
    return okItem(formDto(next))
  }),

  http.post(base('/:id/duplicate'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const current = customForms.find(String(params.id))
    if (!current) return notFound()
    const sectionIds = new Map(current.sections.map((section) => [section.id, createId('cfs')]))
    const stamp = now()
    const copy: FormRec = {
      ...current,
      id: createId('cf'),
      title: `Copy of ${current.title}`.slice(0, 150),
      status: 'draft',
      sections: current.sections.map((section) => ({
        ...section,
        id: sectionIds.get(section.id) ?? createId('cfs'),
      })),
      fields: current.fields.map((field) => ({
        ...field,
        id: createId('cff'),
        sectionId: field.sectionId ? (sectionIds.get(field.sectionId) ?? null) : null,
        options: field.options.map((option) => ({ ...option, id: createId('cfo') })),
      })),
      audience: { ...current.audience, ids: [...current.audience.ids] },
      createdById: callerId(),
      createdAt: stamp,
      updatedAt: stamp,
      publishedAt: null,
      closedAt: null,
      rowVersion: nextRowVersion(),
    }
    customForms.insert(copy)
    return okItem(formDto(copy), 201)
  }),

  http.get(base('/:id/responses/summary'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const form = customForms.find(String(params.id))
    return form ? okItem(summaryOf(form)) : notFound()
  }),

  http.get(base('/:id/responses'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const form = customForms.find(String(params.id))
    if (!form) return notFound()
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const rows = responsesOf(form.id)
      .map((response) => responseDto(response, form))
      .filter((row) => !q || matches(q, row.respondent?.name ?? null, row.respondent?.code ?? null))
    return okPage(rows, url)
  }),

  http.post(base('/:id/responses'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const form = customForms.find(String(params.id))
    const me = callerId()
    if (!form || !reaches(form, me)) return notFound()
    if (form.status === 'draft') {
      return errorResponse(409, 'This form is not published yet.', {
        code: 'FORM_NOT_PUBLISHED',
      })
    }
    if (statusOf(form) === 'closed') {
      return errorResponse(409, 'This form is closed and takes no more answers.', {
        code: 'FORM_CLOSED',
      })
    }
    if (form.oneResponsePerPerson && responsesOf(form.id).some((item) => item.employeeId === me)) {
      return errorResponse(
        409,
        'You have already answered this form. It takes one response per person.',
        {
          code: 'ALREADY_RESPONDED',
        },
      )
    }
    const parsed = answersBody.safeParse(await readJson(request))
    if (!parsed.success) return validationFailed(parsed.error.issues)
    const given = new Map(parsed.data.answers.map((answer) => [answer.fieldId, answer.value]))
    const unknown = [...given.keys()].find((id) => !form.fields.some((field) => field.id === id))
    if (unknown) return invalid({ answers: `No question ${unknown} on this form.` })
    const errors: Record<string, string> = {}
    const answers: AnswerRec[] = []
    for (const field of form.fields) {
      const checked = checkAnswer(field, given.get(field.id))
      if ('error' in checked) errors[`answers.${field.id}`] = checked.error
      else answers.push({ fieldId: field.id, value: checked.value })
    }
    if (Object.keys(errors).length > 0) return invalid(errors, 'Some answers need your attention.')
    const response: ResponseRec = {
      id: createId('cfr'),
      formId: form.id,
      employeeId: me,
      submittedAt: now(),
      answers,
    }
    customFormResponses.insert(response)
    return okItem(responseDto(response, form), 201)
  }),
]
