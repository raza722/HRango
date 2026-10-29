import { differenceInCalendarMonths, format } from 'date-fns'
import { http, type HttpHandler, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  type Contract,
  CONTRACT_TYPES,
  type ContractStatus,
  type Dependent,
  DEPENDENT_RELATIONS,
  DOCUMENT_TYPES,
  type DocumentCategory,
  EMERGENCY_RELATIONS,
  type Employee,
  EMPLOYEE_STATUSES,
  type EmployeeChildKind,
  type EmployeeDocument,
  type Experience,
  GENDERS,
  MARITAL_STATUSES,
  SALARY_FREQUENCIES,
  SKILL_LEVELS,
} from '@/features/talent-management/types/employees.types'
import { parseDateValue } from '@/lib/date'
import type { FileRef } from '@/lib/files'
import type { ApiItem, Paginated } from '@/types/api'

import type { MockCollection } from '../collection'
import { mockFileUrl, mockUploadName } from '../files/handlers'
import { checkRowVersion, conflict, invalidField, validationFailed } from '../settings/crud'
import { areas, branches, jobTitles, locations } from '../settings/handlers'
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
  bankAccounts,
  contracts,
  dependents,
  documents,
  education,
  emergencyContacts,
  employees,
  experience,
  skills,
} from './db'
import {
  type BankAccountRec,
  type ContractRec,
  DEPARTMENT_NAMES,
  type DependentRec,
  DESIGNATION_NAMES,
  type DocumentRec,
  type EducationRec,
  type EmergencyContactRec,
  type EmployeeRec,
  type ExperienceRec,
  nextRowVersion,
  type SkillRec,
} from './seed'

/*
 * The mock of `/api/employees…` (Talent Management → Employees): the list with its filters,
 * create / get / update, identity, photo, deactivate / reactivate, and the child tables
 * (dependents, skills, education, experience, contracts, documents, emergency contacts, bank
 * accounts). It validates as the API does (required fields, lengths, enum values, a unique code,
 * known references), answers 404 for unknown records and 409 for a stale `rowVersion`.
 * Not mocked (no screen uses them): employment periods, history, changes, salary and the
 * update-request inbox; `POST /employees/{id}/update-requests` is the Benefits mock's.
 */

const today = () => format(new Date(), 'yyyy-MM-dd')
const now = () => new Date().toISOString()
const notFound = (what = 'Employee') =>
  errorResponse(404, `${what} not found.`, { code: 'NOT_FOUND' })

async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => null)
}

/** Every handler first: the latency, then the session. */
async function guard(request: Request): Promise<Response | null> {
  await latency()
  return requireAuth(request)
}

// --- schemas (the API's `*In`) ---------------------------------------------------------------

const id = z.preprocess((value) => (typeof value === 'number' ? String(value) : value), z.string())
const optionalId = id.nullable().optional()
const optionalText = (max = 500) => z.string().trim().max(max).nullable().optional()
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date as yyyy-MM-dd.')
const optionalDay = isoDay.nullable().optional()
const rowVersion = z.string().nullable().optional()
const required = (label: string, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} may be at most ${String(max)} characters.`)

const employeeBody = z.object({
  code: z.string().trim().max(30).nullable().optional(),
  firstName: required('First name', 200),
  lastName: required('Last name', 200),
  parentName: optionalText(200),
  gender: z.enum(GENDERS).nullable().optional(),
  maritalStatus: z.enum(MARITAL_STATUSES).nullable().optional(),
  religion: optionalText(100),
  nationality: optionalText(100),
  dateOfBirth: optionalDay,
  cnic: optionalText(20),
  email: z.email('Enter a valid email address.').nullable().optional(),
  phone1: optionalText(30),
  phone2: optionalText(30),
  homeAddress: optionalText(500),
  homeCityId: optionalId,
  branchId: z.preprocess(
    (value) => (typeof value === 'number' ? String(value) : value),
    z.string({ error: 'Branch is required.' }).min(1, 'Branch is required.'),
  ),
  locationId: optionalId,
  areaId: optionalId,
  departmentId: optionalId,
  divisionId: optionalId,
  costCenterId: optionalId,
  designationId: optionalId,
  jobTitleId: optionalId,
  gradeId: optionalId,
  jobLevelId: optionalId,
  employeeGroupId: optionalId,
  employmentTypeId: optionalId,
  lineManagerId: optionalId,
  finalAuthorityId: optionalId,
  status: z.enum(EMPLOYEE_STATUSES).default('active'),
  salaryFrequency: z.enum(SALARY_FREQUENCIES).default('monthly'),
  joiningDate: optionalDay,
  probationEndDate: optionalDay,
  confirmationDate: optionalDay,
  rowVersion,
})
type EmployeeBody = z.infer<typeof employeeBody>

// --- reading ---------------------------------------------------------------------------------

const fullName = (rec: Pick<EmployeeRec, 'firstName' | 'lastName'>) =>
  `${rec.firstName} ${rec.lastName}`.trim()

const nameOf = (employeeId: string | null) => {
  const rec = employeeId ? employees.find(employeeId) : undefined
  return rec ? fullName(rec) : null
}

function monthsBetween(from: string | null, to: string | null): number | null {
  const start = from ? parseDateValue(from) : undefined
  const end = (to ? parseDateValue(to) : undefined) ?? new Date()
  return start ? Math.max(0, differenceInCalendarMonths(end, start)) : null
}

const primaryContact = (employeeId: string) => {
  const rows = emergencyContacts.all().filter((row) => row.employeeId === employeeId)
  return rows.find((row) => row.isPrimary) ?? rows[0]
}

/** `EmployeeOut`: the stored record with the names, counts and tenure the API adds. */
export function toEmployee(rec: EmployeeRec): Employee {
  const contact = primaryContact(rec.id)
  return {
    ...rec,
    name: fullName(rec),
    canSeeIdentity: true,
    homeCityName: null,
    photoUrl: rec.photoFileId ? mockFileUrl(rec.photoFileId) : null,
    branchName: branches.find(rec.branchId)?.name ?? '',
    locationName: rec.locationId ? (locations.find(rec.locationId)?.name ?? null) : null,
    areaName: rec.areaId ? (areas.find(rec.areaId)?.name ?? null) : null,
    lineManagerName: nameOf(rec.lineManagerId),
    finalAuthorityName: nameOf(rec.finalAuthorityId),
    tenureMonths: monthsBetween(rec.joiningDate, rec.endDate),
    emergencyContactName: contact?.name ?? null,
    emergencyContactPhone: contact?.phone ?? null,
    directReportCount: employees.all().filter((row) => row.lineManagerId === rec.id).length,
  }
}

const LIST_FILTERS = [
  'branchId',
  'locationId',
  'areaId',
  'departmentId',
  'divisionId',
  'designationId',
  'jobTitleId',
  'gradeId',
  'employmentTypeId',
  'employeeGroupId',
  'lineManagerId',
] as const satisfies readonly (keyof EmployeeRec)[]

const INACTIVE = new Set(['inactive', 'left'])

// --- writing ---------------------------------------------------------------------------------

/** The names behind the ids the body gives; a 422 for an id the mock does not know. */
function resolveNames(body: EmployeeBody, selfId: string | null) {
  const errors: Record<string, string> = {}
  const branch = branches.find(body.branchId)
  if (!branch) errors.branchId = 'Choose a valid branch.'
  if (body.locationId && !locations.find(body.locationId)) {
    errors.locationId = 'Choose a valid location.'
  }
  if (body.areaId && !areas.find(body.areaId)) errors.areaId = 'Choose a valid area.'
  const departmentName = body.departmentId ? DEPARTMENT_NAMES.get(body.departmentId) : null
  if (body.departmentId && !departmentName) errors.departmentId = 'Choose a valid department.'
  const titleName = (value: string | null | undefined) =>
    value ? (jobTitles.find(value)?.name ?? DESIGNATION_NAMES.get(value) ?? null) : null
  const designationName = titleName(body.designationId)
  if (body.designationId && !designationName) {
    errors.designationId = 'Choose a valid designation.'
  }
  const jobTitleName = titleName(body.jobTitleId)
  if (body.jobTitleId && !jobTitleName) errors.jobTitleId = 'Choose a valid job title.'
  // The mock company has no divisions, cost centres, grades, job levels, groups or types.
  for (const field of [
    'divisionId',
    'costCenterId',
    'gradeId',
    'jobLevelId',
    'employeeGroupId',
    'employmentTypeId',
  ] as const) {
    if (body[field]) errors[field] = 'Choose a valid option.'
  }
  for (const field of ['lineManagerId', 'finalAuthorityId'] as const) {
    const personId = body[field]
    if (!personId) continue
    if (personId === selfId) errors[field] = 'An employee cannot report to themselves.'
    else if (!employees.find(personId)) errors[field] = 'Choose a valid employee.'
  }
  if (body.dateOfBirth && body.dateOfBirth >= today()) {
    errors.dateOfBirth = 'The date of birth must be in the past.'
  }
  if (body.joiningDate && body.probationEndDate && body.probationEndDate < body.joiningDate) {
    errors.probationEndDate = 'Probation cannot end before the joining date.'
  }
  if (body.joiningDate && body.confirmationDate && body.confirmationDate < body.joiningDate) {
    errors.confirmationDate = 'Confirmation cannot be before the joining date.'
  }
  if (Object.keys(errors).length > 0) {
    return errorResponse(422, 'Some fields need your attention.', {
      code: 'VALIDATION_FAILED',
      fieldErrors: errors,
    })
  }
  return {
    departmentName: departmentName ?? null,
    designationName,
    jobTitleName,
    locationId: body.locationId ?? branch?.locationId ?? null,
  }
}

/** The next free `EMP-0000` code. */
function nextCode(): string {
  const highest = employees
    .all()
    .map((rec) => /^EMP-(\d+)$/.exec(rec.code)?.[1])
    .reduce((max, digits) => Math.max(max, digits ? Number(digits) : 0), 0)
  return `EMP-${String(highest + 1).padStart(4, '0')}`
}

function writeEmployee(
  body: EmployeeBody,
  raw: unknown,
  current: EmployeeRec | undefined,
): Response | EmployeeRec {
  const names = resolveNames(body, current?.id ?? null)
  if (names instanceof Response) return names
  const given = body.code?.trim() ?? ''
  const code = given !== '' ? given : (current?.code ?? nextCode())
  const taken = employees
    .all()
    .some((rec) => rec.id !== current?.id && rec.code.toLowerCase() === code.toLowerCase())
  if (taken) {
    return errorResponse(409, 'Another employee already has this code.', {
      code: 'EMPLOYEE_CODE_DUPLICATE',
      fieldErrors: { code: 'Another employee already has this code.' },
    })
  }
  // A body without `cnic` keeps the stored one (identity has its own endpoint).
  const sentCnic = typeof raw === 'object' && raw !== null && 'cnic' in raw
  const id = current?.id ?? createId('em')
  return {
    id,
    code,
    firstName: body.firstName,
    lastName: body.lastName,
    parentName: body.parentName ?? null,
    gender: body.gender ?? null,
    maritalStatus: body.maritalStatus ?? null,
    religion: body.religion ?? null,
    nationality: body.nationality ?? null,
    dateOfBirth: body.dateOfBirth ?? null,
    cnic: sentCnic ? (body.cnic ?? null) : (current?.cnic ?? null),
    email: body.email ?? null,
    phone1: body.phone1 ?? null,
    phone2: body.phone2 ?? null,
    homeAddress: body.homeAddress ?? null,
    homeCityId: body.homeCityId ?? null,
    photoFileId: current?.photoFileId ?? null,
    branchId: body.branchId,
    locationId: names.locationId,
    areaId: body.areaId ?? null,
    departmentId: body.departmentId ?? null,
    departmentName: names.departmentName,
    divisionId: null,
    divisionName: null,
    costCenterId: null,
    costCenterName: null,
    designationId: body.designationId ?? null,
    designationName: names.designationName,
    jobTitleId: body.jobTitleId ?? null,
    jobTitleName: names.jobTitleName,
    gradeId: null,
    gradeName: null,
    jobLevelId: null,
    jobLevelName: null,
    employeeGroupId: null,
    employeeGroupName: null,
    employmentTypeId: null,
    employmentTypeName: null,
    lineManagerId: body.lineManagerId ?? null,
    finalAuthorityId: body.finalAuthorityId ?? null,
    status: body.status,
    salaryFrequency: body.salaryFrequency,
    joiningDate: body.joiningDate ?? null,
    confirmationDate: body.confirmationDate ?? null,
    probationEndDate: body.probationEndDate ?? null,
    endDate: INACTIVE.has(body.status) ? (current?.endDate ?? today()) : null,
    userAccountId: current?.userAccountId ?? null,
    createdAt: current?.createdAt ?? now(),
    updatedAt: current ? now() : null,
    rowVersion: nextRowVersion(),
  }
}

const item = <T>(data: T, status = 200) => HttpResponse.json<ApiItem<T>>({ data }, { status })

/** The path segments `/employees/:id` must leave to the other handlers. */
const RESERVED = new Set(['lookup', 'update-requests'])

const employeeHandlers: HttpHandler[] = [
  http.get(apiPath('/employees'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const status = url.searchParams.get('status')
    const includeInactive = url.searchParams.get('includeInactive') === 'true'
    const rows = employees
      .all()
      .filter((rec) =>
        status ? rec.status === status : includeInactive || !INACTIVE.has(rec.status),
      )
      .filter(
        (rec) => !q || `${rec.code} ${fullName(rec)} ${rec.email ?? ''}`.toLowerCase().includes(q),
      )
      .filter((rec) =>
        LIST_FILTERS.every((key) => {
          const wanted = url.searchParams.get(key)
          return !wanted || rec[key] === wanted
        }),
      )
      .sort((a, b) => a.code.localeCompare(b.code))
      .map(toEmployee)
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json<Paginated<Employee>>(paginate(rows, page, pageSize))
  }),

  http.post(apiPath('/employees'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const raw = await readJson(request)
    const parsed = employeeBody.safeParse(raw)
    if (!parsed.success) return validationFailed(parsed.error.issues)
    const rec = writeEmployee(parsed.data, raw, undefined)
    if (rec instanceof Response) return rec
    employees.insert(rec)
    return item(toEmployee(rec), 201)
  }),

  http.get<{ id: string }>(apiPath('/employees/:id'), async ({ request, params }) => {
    if (RESERVED.has(params.id)) return undefined
    const denied = await guard(request)
    if (denied) return denied
    const rec = employees.find(params.id)
    return rec ? item(toEmployee(rec)) : notFound()
  }),

  http.put<{ id: string }>(apiPath('/employees/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const current = employees.find(params.id)
    if (!current) return notFound()
    const raw = await readJson(request)
    const parsed = employeeBody.safeParse(raw)
    if (!parsed.success) return validationFailed(parsed.error.issues)
    if (parsed.data.rowVersion && parsed.data.rowVersion !== current.rowVersion) {
      return conflict('Someone else changed this employee. Reload it and try again')
    }
    const rec = writeEmployee(parsed.data, raw, current)
    if (rec instanceof Response) return rec
    employees.update(rec.id, rec)
    return item(toEmployee(rec))
  }),

  http.put<{ id: string }>(apiPath('/employees/:id/identity'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const current = employees.find(params.id)
    if (!current) return notFound()
    const parsed = z
      .object({ cnic: optionalText(20), rowVersion: z.unknown() })
      .safeParse(await readJson(request))
    if (!parsed.success) return validationFailed(parsed.error.issues)
    const stale = checkRowVersion(parsed.data.rowVersion, current, 'employee')
    if (stale) return stale
    const cnic = parsed.data.cnic ?? null
    if (cnic && !/^[0-9-]{5,20}$/.test(cnic)) {
      return invalidField('cnic', 'Enter the CNIC as digits, e.g. 35202-1234567-1.')
    }
    const rec = { ...current, cnic, updatedAt: now(), rowVersion: nextRowVersion() }
    employees.update(rec.id, rec)
    return item(toEmployee(rec))
  }),

  http.put<{ id: string }>(apiPath('/employees/:id/photo'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const current = employees.find(params.id)
    if (!current) return notFound()
    const parsed = z
      .object({ fileId: optionalId, rowVersion: z.unknown() })
      .safeParse(await readJson(request))
    if (!parsed.success) return validationFailed(parsed.error.issues)
    const stale = checkRowVersion(parsed.data.rowVersion, current, 'employee')
    if (stale) return stale
    const rec = {
      ...current,
      photoFileId: parsed.data.fileId ?? null,
      updatedAt: now(),
      rowVersion: nextRowVersion(),
    }
    employees.update(rec.id, rec)
    return item(toEmployee(rec))
  }),

  ...(['deactivate', 'reactivate'] as const).map((action) =>
    http.patch<{ id: string }>(apiPath(`/employees/:id/${action}`), async ({ request, params }) => {
      const denied = await guard(request)
      if (denied) return denied
      const current = employees.find(params.id)
      if (!current) return notFound()
      const body = (await readJson(request)) as { rowVersion?: unknown } | null
      const stale = checkRowVersion(body?.rowVersion, current, 'employee')
      if (stale) return stale
      const inactive = INACTIVE.has(current.status)
      if (action === 'deactivate' && inactive) {
        return errorResponse(409, 'This employee is already inactive.', {
          code: 'EMPLOYEE_INACTIVE',
        })
      }
      if (action === 'reactivate' && !inactive) {
        return errorResponse(409, 'This employee is already active.', {
          code: 'EMPLOYEE_ACTIVE',
        })
      }
      const rec: EmployeeRec = {
        ...current,
        status: action === 'deactivate' ? 'inactive' : 'active',
        endDate: action === 'deactivate' ? today() : null,
        updatedAt: now(),
        rowVersion: nextRowVersion(),
      }
      employees.update(rec.id, rec)
      return item(toEmployee(rec))
    }),
  ),
]

// --- child tables ------------------------------------------------------------------------------

interface ChildBase {
  id: string
  employeeId: string
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

interface ChildSpec<TRec extends ChildBase, TBody, TOut> {
  kind: EmployeeChildKind
  /** "Dependent", for messages. */
  label: string
  idPrefix: string
  collection: MockCollection<TRec>
  schema: z.ZodType<TBody>
  /** Rules beyond the schema (dates in order, duplicates); a Response refuses the write. */
  check?: (body: TBody, employeeId: string, current: TRec | undefined) => Response | null
  build: (body: TBody, base: ChildBase, current: TRec | undefined) => TRec
  toOut: (rec: TRec) => TOut
  /** After a write or delete (e.g. keep one primary row). */
  after?: (employeeId: string, changedId: string | null) => void
  order?: (a: TRec, b: TRec) => number
}

function childHandlers<TRec extends ChildBase, TBody, TOut>(
  spec: ChildSpec<TRec, TBody, TOut>,
): HttpHandler[] {
  const { kind, label, collection } = spec
  const rowsOf = (employeeId: string) =>
    collection
      .all()
      .filter((rec) => rec.employeeId === employeeId)
      .sort(spec.order ?? ((a, b) => a.createdAt.localeCompare(b.createdAt)))
  const list = apiPath(`/employees/:id/${kind}`)
  const one = apiPath(`/employees/:id/${kind}/:rowId`)
  const rowOf = (employeeId: string, rowId: string) => {
    const rec = collection.find(rowId)
    return rec?.employeeId === employeeId ? rec : undefined
  }

  async function save(request: Request, employeeId: string, rowId: string | null) {
    const denied = await guard(request)
    if (denied) return denied
    if (!employees.find(employeeId)) return notFound()
    const current = rowId ? rowOf(employeeId, rowId) : undefined
    if (rowId && !current) return notFound(label)
    const raw = (await readJson(request)) as { rowVersion?: unknown } | null
    const parsed = spec.schema.safeParse(raw)
    if (!parsed.success) return validationFailed(parsed.error.issues)
    if (current && typeof raw?.rowVersion === 'string' && raw.rowVersion !== current.rowVersion) {
      return conflict(`Someone else changed this ${label.toLowerCase()}. Reload it and try again`)
    }
    const refused = spec.check?.(parsed.data, employeeId, current)
    if (refused) return refused
    const rec = spec.build(
      parsed.data,
      {
        id: current?.id ?? createId(spec.idPrefix),
        employeeId,
        createdAt: current?.createdAt ?? now(),
        updatedAt: current ? now() : null,
        rowVersion: nextRowVersion(),
      },
      current,
    )
    if (current) collection.update(rec.id, rec)
    else collection.insert(rec)
    spec.after?.(employeeId, rec.id)
    const saved = collection.find(rec.id) ?? rec
    return item(spec.toOut(saved), current ? 200 : 201)
  }

  return [
    http.get<{ id: string }>(list, async ({ request, params }) => {
      const denied = await guard(request)
      if (denied) return denied
      if (!employees.find(params.id)) return notFound()
      return item(rowsOf(params.id).map(spec.toOut))
    }),
    http.post<{ id: string }>(list, ({ request, params }) => save(request, params.id, null)),
    http.put<{ id: string; rowId: string }>(one, ({ request, params }) =>
      save(request, params.id, params.rowId),
    ),
    http.delete<{ id: string; rowId: string }>(one, async ({ request, params }) => {
      const denied = await guard(request)
      if (denied) return denied
      if (!employees.find(params.id)) return notFound()
      const current = rowOf(params.id, params.rowId)
      if (!current) return notFound(label)
      const given = new URL(request.url).searchParams.get('rowVersion')
      if (given && given !== current.rowVersion) {
        return conflict(`Someone else changed this ${label.toLowerCase()}. Reload it and try again`)
      }
      collection.remove(current.id)
      spec.after?.(params.id, null)
      return new HttpResponse(null, { status: 204 })
    }),
  ]
}

/** A file reference for an upload id (the name `POST /files` was given, when it is known). */
function fileOf(fileId: string | null | undefined, current: FileRef | null = null): FileRef | null {
  if (!fileId) return null
  if (current?.id === fileId) return current
  return { id: fileId, name: mockUploadName(fileId) ?? `File ${fileId}`, url: mockFileUrl(fileId) }
}

/** 422 when `to` comes before `from`. */
function datesInOrder(
  from: string | null | undefined,
  to: string | null | undefined,
  field = 'toDate',
) {
  return from && to && to < from
    ? invalidField(field, 'The end date cannot be before the start date.')
    : null
}

/** Keeps exactly one primary row per person (the one just marked, else the oldest). */
function onePrimary<T extends ChildBase & { isPrimary: boolean }>(collection: MockCollection<T>) {
  return (employeeId: string, changedId: string | null) => {
    const rows = collection
      .all()
      .filter((rec) => rec.employeeId === employeeId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const changed = changedId ? rows.find((rec) => rec.id === changedId) : undefined
    const primary = changed?.isPrimary ? changed : (rows.find((rec) => rec.isPrimary) ?? rows[0])
    for (const rec of rows) {
      const isPrimary = rec.id === primary?.id
      if (rec.isPrimary !== isPrimary) collection.update(rec.id, { ...rec, isPrimary })
    }
  }
}

const IDENTITY_TYPES = new Set(['cnic', 'passport', 'driving_licence'])
const PAY_TYPES = new Set([
  'offer_letter',
  'promotion_letter',
  'appraisal_letter',
  'salary_certificate',
])

function contractStatus(rec: ContractRec): ContractStatus {
  const day = today()
  if (rec.fromDate > day) return 'upcoming'
  if (rec.toDate && rec.toDate < day) return 'expired'
  return 'active'
}

const childTableHandlers: HttpHandler[] = [
  ...childHandlers({
    kind: 'dependents',
    label: 'Dependent',
    idPrefix: 'dp',
    collection: dependents,
    schema: z.object({
      firstName: required('First name', 200),
      lastName: optionalText(200),
      relation: z.enum(DEPENDENT_RELATIONS),
      occupation: optionalText(200),
      dateOfBirth: optionalDay,
      rowVersion,
    }),
    build: (body, base): DependentRec => ({
      ...base,
      firstName: body.firstName,
      lastName: body.lastName ?? null,
      relation: body.relation,
      occupation: body.occupation ?? null,
      dateOfBirth: body.dateOfBirth ?? null,
    }),
    toOut: (rec): Dependent => ({
      ...rec,
      name: [rec.firstName, rec.lastName].filter(Boolean).join(' '),
    }),
  }),

  ...childHandlers({
    kind: 'skills',
    label: 'Skill',
    idPrefix: 'sk',
    collection: skills,
    schema: z.object({
      skillTitle: required('Skill title', 200),
      skillLevel: z.enum(SKILL_LEVELS),
      rowVersion,
    }),
    check: (body, employeeId, current) =>
      skills
        .all()
        .some(
          (rec) =>
            rec.employeeId === employeeId &&
            rec.id !== current?.id &&
            rec.skillTitle.toLowerCase() === body.skillTitle.toLowerCase(),
        )
        ? errorResponse(409, 'This skill is already on the profile.', {
            code: 'SKILL_DUPLICATE',
            fieldErrors: { skillTitle: 'This skill is already on the profile.' },
          })
        : null,
    build: (body, base): SkillRec => ({
      ...base,
      skillTitle: body.skillTitle,
      skillLevel: body.skillLevel,
    }),
    toOut: (rec) => rec,
  }),

  ...childHandlers({
    kind: 'education',
    label: 'Academic record',
    idPrefix: 'ed',
    collection: education,
    schema: z.object({
      title: required('Title', 200),
      institute: required('Institute', 200),
      fromDate: optionalDay,
      toDate: optionalDay,
      isInProcess: z.boolean().default(false),
      fileId: optionalId,
      rowVersion,
    }),
    check: (body) => datesInOrder(body.fromDate, body.isInProcess ? null : body.toDate),
    build: (body, base, current): EducationRec => ({
      ...base,
      title: body.title,
      institute: body.institute,
      fromDate: body.fromDate ?? null,
      toDate: body.isInProcess ? null : (body.toDate ?? null),
      isInProcess: body.isInProcess,
      file: fileOf(body.fileId, current?.file),
    }),
    toOut: (rec) => rec,
    order: (a, b) => (b.fromDate ?? '').localeCompare(a.fromDate ?? ''),
  }),

  ...childHandlers({
    kind: 'experience',
    label: 'Experience',
    idPrefix: 'ex',
    collection: experience,
    schema: z.object({
      companyName: required('Company name', 200),
      jobTitle: required('Job title', 100),
      fromDate: isoDay,
      toDate: optionalDay,
      rowVersion,
    }),
    check: (body) =>
      datesInOrder(body.fromDate, body.toDate) ??
      (body.fromDate > today()
        ? invalidField('fromDate', 'The start date cannot be ahead.')
        : null),
    build: (body, base): ExperienceRec => ({
      ...base,
      companyName: body.companyName,
      jobTitle: body.jobTitle,
      fromDate: body.fromDate,
      toDate: body.toDate ?? null,
    }),
    toOut: (rec): Experience => ({
      ...rec,
      isCurrent: rec.toDate === null,
      months: monthsBetween(rec.fromDate, rec.toDate),
    }),
    order: (a, b) => b.fromDate.localeCompare(a.fromDate),
  }),

  ...childHandlers({
    kind: 'contracts',
    label: 'Contract',
    idPrefix: 'ct',
    collection: contracts,
    schema: z.object({
      contractType: z.enum(CONTRACT_TYPES),
      durationMonths: z.number().int().min(1).max(600).nullable().optional(),
      fromDate: isoDay,
      toDate: optionalDay,
      fileId: optionalId,
      remarks: optionalText(1000),
      rowVersion,
    }),
    check: (body) => datesInOrder(body.fromDate, body.toDate),
    build: (body, base, current): ContractRec => ({
      ...base,
      contractType: body.contractType,
      durationMonths: body.durationMonths ?? null,
      fromDate: body.fromDate,
      toDate: body.toDate ?? null,
      file: fileOf(body.fileId, current?.file),
      remarks: body.remarks ?? null,
    }),
    toOut: (rec): Contract => ({ ...rec, status: contractStatus(rec) }),
    order: (a, b) => b.fromDate.localeCompare(a.fromDate),
  }),

  ...childHandlers({
    kind: 'documents',
    label: 'Document',
    idPrefix: 'dc',
    collection: documents,
    schema: z.object({
      documentType: z.enum(DOCUMENT_TYPES),
      title: optionalText(200),
      documentNumber: optionalText(100),
      issueDate: optionalDay,
      expiryDate: optionalDay,
      fileId: id.refine((value) => value !== '', 'Choose the file.'),
      remarks: optionalText(1000),
      rowVersion,
    }),
    check: (body) => datesInOrder(body.issueDate, body.expiryDate, 'expiryDate'),
    build: (body, base, current): DocumentRec => {
      const file = fileOf(body.fileId, current?.file) ?? {
        id: body.fileId,
        name: null,
        url: mockFileUrl(body.fileId),
      }
      return {
        ...base,
        documentType: body.documentType,
        title: body.title ?? null,
        documentNumber: body.documentNumber ?? null,
        issueDate: body.issueDate ?? null,
        expiryDate: body.expiryDate ?? null,
        file,
        fileMimeType: current?.file.id === file.id ? current.fileMimeType : null,
        fileSizeBytes: current?.file.id === file.id ? current.fileSizeBytes : null,
        remarks: body.remarks ?? null,
      }
    },
    toOut: (rec): EmployeeDocument => ({
      ...rec,
      category: (IDENTITY_TYPES.has(rec.documentType)
        ? 'identity'
        : PAY_TYPES.has(rec.documentType)
          ? 'pay'
          : 'general') satisfies DocumentCategory,
      isExpired: rec.expiryDate !== null && rec.expiryDate < today(),
    }),
    order: (a, b) => b.createdAt.localeCompare(a.createdAt),
  }),

  ...childHandlers({
    kind: 'emergency-contacts',
    label: 'Emergency contact',
    idPrefix: 'ec',
    collection: emergencyContacts,
    schema: z.object({
      name: required('Name', 200),
      relation: z.enum(EMERGENCY_RELATIONS),
      phone: required('Phone', 30),
      altPhone: optionalText(30),
      address: optionalText(500),
      isPrimary: z.boolean().default(false),
      rowVersion,
    }),
    build: (body, base): EmergencyContactRec => ({
      ...base,
      name: body.name,
      relation: body.relation,
      phone: body.phone,
      altPhone: body.altPhone ?? null,
      address: body.address ?? null,
      isPrimary: body.isPrimary,
    }),
    toOut: (rec) => rec,
    after: onePrimary(emergencyContacts),
  }),

  ...childHandlers({
    kind: 'bank-accounts',
    label: 'Bank account',
    idPrefix: 'ba',
    collection: bankAccounts,
    schema: z.object({
      accountHolder: optionalText(200),
      accountNumber: required('Account number', 50),
      bankName: required('Bank name', 200),
      branchName: optionalText(200),
      branchCode: optionalText(50),
      taxPayerId: optionalText(50),
      isPrimary: z.boolean().default(false),
      rowVersion,
    }),
    check: (body, employeeId, current) =>
      bankAccounts
        .all()
        .some(
          (rec) =>
            rec.employeeId === employeeId &&
            rec.id !== current?.id &&
            rec.accountNumber.replace(/\s/g, '') === body.accountNumber.replace(/\s/g, ''),
        )
        ? errorResponse(409, 'This account is already on the profile.', {
            code: 'BANK_ACCOUNT_DUPLICATE',
            fieldErrors: { accountNumber: 'This account is already on the profile.' },
          })
        : null,
    build: (body, base): BankAccountRec => ({
      ...base,
      accountHolder: body.accountHolder ?? null,
      accountNumber: body.accountNumber,
      bankName: body.bankName,
      branchName: body.branchName ?? null,
      branchCode: body.branchCode ?? null,
      taxPayerId: body.taxPayerId ?? null,
      isPrimary: body.isPrimary,
    }),
    toOut: (rec) => rec,
    after: onePrimary(bankAccounts),
  }),
]

/**
 * Every `/employees…` route this mock answers. Register after the modules that answer
 * `/employees/lookup` (their pickers keep their own data); `GET /employees/:id` passes
 * `lookup` and `update-requests` on.
 */
export const talentManagementHandlers: HttpHandler[] = [...childTableHandlers, ...employeeHandlers]
