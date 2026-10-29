import { addMonths, format, subDays } from 'date-fns'
import { http, type HttpHandler, HttpResponse } from 'msw'
import { z } from 'zod'

import type { DashboardOutDto } from '@/features/recruitment/api/recruitment.dto'
import type { ApiItem, Paginated } from '@/types/api'

import { DIRECTORY, findEmployee } from '../employees/seed'
import { openPositions } from '../manpower-planning/db'
import { PROFILES } from '../scheduling/seed'
import { checkRowVersion } from '../settings/crud'
import { branches, jobTitles } from '../settings/handlers'
import { CITIES } from '../settings/seed'
import { employees } from '../talent-management/db'
import {
  codeOf,
  DEPARTMENT_NAMES,
  DESIGNATION_NAMES,
  type EmployeeRec,
  nextRowVersion as nextEmployeeVersion,
} from '../talent-management/seed'
import { apiPath, errorResponse, latency, paginate, readPageParams, requireAuth } from '../utils'
import {
  applicants,
  applications,
  evaluations,
  history,
  interviews,
  nextId,
  offers,
  openings,
  reasons,
  resetRecruitmentCollections,
} from './db'
import {
  applicantDetailOut,
  applicantOut,
  applicationDetailOut,
  applicationOut,
  departmentName,
  fullName,
  interviewDetailOut,
  interviewOut,
  isActive,
  localDay,
  offerExpired,
  offerOut,
  openingOut,
  personOf,
  reasonOut,
  titleName,
} from './out'
import {
  ACTOR,
  ACTOR_EMPLOYEE_ID,
  type ApplicantRec,
  type ApplicationRec,
  type InterviewRec,
  nextRowVersion,
  type OfferRec,
  type OpeningRec,
  type ReasonRec,
  type StageValue,
} from './seed'

/*
 * The mock of `/api/recruitment/…`, as the backend's OpenAPI describes it: paged lists
 * (`{data, meta}`), records as `{data}`, 201 on create, 204 on delete, 422 `{message,
 * fieldErrors}` for bad input, 404 for unknown records and 409 for a stale `rowVersion` or a
 * step the record's state does not allow. Rules the spec leaves to the server are written as an
 * HR team would expect them:
 * - openings: draft → publish → open ⇄ hold, open / on hold → close, on hold / closed → reopen;
 *   only a draft or an opening without applications can be deleted; new applications need an
 *   open opening;
 * - applications: move between applied … offer while active; reject (an active reason), withdraw
 *   and hire end it, after which nothing moves it; hire needs a vacancy left and creates the
 *   employee in the Employees mock (Talent Management), with the accepted offer's placement;
 * - interviews: scheduling moves an earlier application to Interview; only a scheduled one is
 *   edited, cancelled or completed; only its interviewers evaluate (saving again replaces it);
 * - offers: one open offer (draft / sent / accepted) per application; draft → send → accept /
 *   decline, draft or sent → withdraw; only a draft is edited or deleted; sending moves the
 *   application to Offer.
 */

// --- responses ----------------------------------------------------------------------------------

const item = <T>(data: T, status = 200) => HttpResponse.json<ApiItem<T>>({ data }, { status })
const page = <T>(rows: readonly T[], url: URL) => {
  const { page: number, pageSize } = readPageParams(url)
  return HttpResponse.json<Paginated<T>>(paginate(rows, number, pageSize))
}
const noContent = () => new HttpResponse(null, { status: 204 })
const notFound = (what: string) => errorResponse(404, `${what} not found.`, { code: 'NOT_FOUND' })
const refused = (message: string, field?: string) =>
  errorResponse(409, message, {
    code: 'CONFLICT',
    ...(field ? { fieldErrors: { [field]: message } } : {}),
  })
const invalidFields = (fieldErrors: Record<string, string>) =>
  errorResponse(422, 'Some fields need your attention.', { code: 'VALIDATION_FAILED', fieldErrors })

/** 422 from a zod failure: one message per field path (`applicant.email`). */
function invalid(issues: readonly z.core.$ZodIssue[]): Response {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const field = issue.path.map(String).join('.') || 'body'
    if (!(field in fieldErrors)) fieldErrors[field] = issue.message
  }
  return invalidFields(fieldErrors)
}

async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => null)
}

async function parse<T>(request: Request, schema: z.ZodType<T>): Promise<T | Response> {
  const result = schema.safeParse(await readJson(request))
  return result.success ? result.data : invalid(result.error.issues)
}

const now = () => new Date().toISOString()
/** Trimmed text, or null for nothing / only spaces. */
const filled = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}
const today = () => format(new Date(), 'yyyy-MM-dd')

// --- body schemas -------------------------------------------------------------------------------

const asString = (value: unknown) => (typeof value === 'number' ? String(value) : value)
const id = z.preprocess(asString, z.string().min(1))
const optionalId = id.nullable().optional()
const text = (max: number) => z.string().trim().max(max).nullable().optional()
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date as yyyy-MM-dd.')
const optionalDay = isoDay.nullable().optional()
const amount = z
  .preprocess(
    (value) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value),
    z.number({ error: 'Enter a number.' }).min(0, 'Must be 0 or more.'),
  )
  .nullable()
  .optional()
const whole = (min: number, max: number) =>
  z.number().int('Enter a whole number.').min(min).max(max).nullable().optional()
const rowVersion = z.string().nullable().optional()
const requiredVersion = z
  .string({ error: 'rowVersion is required.' })
  .min(1, 'rowVersion is required.')

const SOURCES = [
  'career_site',
  'referral',
  'job_board',
  'linkedin',
  'walk_in',
  'agency',
  'other',
] as const

const openingBody = z.object({
  code: text(30),
  title: text(200),
  openPositionId: optionalId,
  jobTitleId: optionalId,
  designationId: optionalId,
  departmentId: optionalId,
  branchId: optionalId,
  employmentTypeId: optionalId,
  hiringManagerId: optionalId,
  cityId: optionalId,
  workMode: z.enum(['on_site', 'remote', 'hybrid']).nullable().optional(),
  experienceFromYears: whole(0, 60),
  experienceToYears: whole(0, 60),
  vacancies: whole(1, 10_000),
  postedOn: optionalDay,
  applyBy: optionalDay,
  closeOn: optionalDay,
  salaryFrom: amount,
  salaryTo: amount,
  isSalaryVisible: z.boolean().default(false),
  description: z.string().nullable().optional(),
  requirements: z.string().nullable().optional(),
  rowVersion,
})
type OpeningBody = z.infer<typeof openingBody>

/** A person's name: at most 100 characters (the form's limit). */
const NAME_MAX = 100
/** Digits with + ( ) - and spaces, 5 to 30 of them (Talent Management's rule). */
const PHONE = /^[0-9+()\-\s]{5,30}$/
const phoneText = text(30).refine(
  (value) => value === null || value === undefined || value === '' || PHONE.test(value),
  'Enter a valid phone number.',
)

const applicantBody = z.object({
  firstName: z
    .string({ error: 'First name is required.' })
    .trim()
    .min(1, 'First name is required.')
    .max(NAME_MAX, `Keep it under ${String(NAME_MAX)} characters.`),
  lastName: z
    .string({ error: 'Last name is required.' })
    .trim()
    .min(1, 'Last name is required.')
    .max(NAME_MAX, `Keep it under ${String(NAME_MAX)} characters.`),
  email: z
    .string({ error: 'Email is required.' })
    .trim()
    .min(3)
    .max(254)
    .pipe(z.email('Enter a valid email address.')),
  phone: phoneText,
  gender: z.enum(['male', 'female', 'other']).nullable().optional(),
  dateOfBirth: optionalDay,
  cityId: optionalId,
  address: text(500),
  currentEmployer: text(200),
  currentJobTitle: text(200),
  experienceYears: z
    .preprocess(
      (value) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value),
      z.number().min(0).max(99),
    )
    .nullable()
    .optional(),
  currentSalary: amount,
  expectedSalary: amount,
  noticePeriodDays: whole(0, 365),
  highestEducation: text(200),
  linkedinUrl: text(500),
  source: z.enum(SOURCES).nullable().optional(),
  referredByEmployeeId: optionalId,
  cvFileId: optionalId,
  notes: z.string().nullable().optional(),
  rowVersion,
})
type ApplicantBody = z.infer<typeof applicantBody>

const applicationBody = z.object({
  jobOpeningId: id,
  applicantId: optionalId,
  applicant: applicantBody.nullable().optional(),
  appliedOn: optionalDay,
  source: z.enum(SOURCES).nullable().optional(),
  coverLetter: z.string().nullable().optional(),
  remarks: text(4000),
})

const stageBody = z.object({
  stage: z.enum(['applied', 'screening', 'shortlisted', 'interview', 'offer'], {
    error: 'Choose a stage: applied, screening, shortlisted, interview or offer.',
  }),
  remarks: text(4000),
  rowVersion: requiredVersion,
})
const rejectBody = z.object({
  rejectionReasonId: optionalId,
  remarks: text(4000),
  rowVersion: requiredVersion,
})
const remarksBody = z.object({ remarks: text(4000), rowVersion: requiredVersion })
const versionBody = z.object({ rowVersion: requiredVersion })
const hireBody = z.object({
  rowVersion: requiredVersion,
  code: text(30),
  joiningDate: optionalDay,
  branchId: optionalId,
  departmentId: optionalId,
  designationId: optionalId,
  jobTitleId: optionalId,
  employmentTypeId: optionalId,
  lineManagerId: optionalId,
  salary: amount,
  status: z.enum(['active', 'probation']).nullable().optional(),
  probationEndDate: optionalDay,
  cnic: text(15),
  remarks: text(4000),
})

const interviewBody = z.object({
  applicationId: optionalId,
  title: text(200),
  mode: z.enum(['in_person', 'phone', 'video']).default('in_person'),
  scheduledAt: z.iso.datetime({ offset: true, error: 'Use a date and time.' }),
  durationMinutes: z
    .number()
    .int()
    .min(5, 'At least 5 minutes.')
    .max(600, 'At most 600 minutes.')
    .default(60),
  venue: text(500),
  remarks: z.string().nullable().optional(),
  interviewerIds: z
    .array(id, { error: 'Choose the interviewers.' })
    .min(1, 'Choose at least one interviewer.'),
  rowVersion,
})
const completeBody = z.object({
  status: z.enum(['completed', 'no_show']).default('completed'),
  result: z.enum(['passed', 'failed', 'on_hold']).nullable().optional(),
  remarks: text(4000),
  rowVersion: requiredVersion,
})
const evaluationBody = z.object({
  employeeId: optionalId,
  rating: z
    .number({ error: 'Rating is required.' })
    .int()
    .min(1, 'Rate from 1 to 5.')
    .max(5, 'Rate from 1 to 5.'),
  recommendation: z.enum(['strong_hire', 'hire', 'no_hire', 'strong_no_hire'], {
    error: 'Choose a recommendation.',
  }),
  strengths: z.string().nullable().optional(),
  concerns: z.string().nullable().optional(),
  comments: z.string().nullable().optional(),
})

const offerBody = z.object({
  applicationId: optionalId,
  jobTitleId: optionalId,
  designationId: optionalId,
  departmentId: optionalId,
  branchId: optionalId,
  employmentTypeId: optionalId,
  offeredSalary: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value),
    z.number({ error: 'Offered salary is required.' }).positive('Offered salary is required.'),
  ),
  salaryFrequency: z.enum(['monthly', 'daily', 'hourly']).default('monthly'),
  joiningDate: isoDay,
  probationMonths: whole(0, 24),
  expiresOn: optionalDay,
  offerLetterFileId: optionalId,
  remarks: text(4000),
  rowVersion,
})
const respondBody = z.object({
  decision: z.enum(['accepted', 'declined'], { error: 'Choose accepted or declined.' }),
  remarks: text(4000),
  rowVersion: requiredVersion,
})
const reasonBody = z.object({
  name: z.string({ error: 'Name is required.' }).trim().min(1, 'Name is required.').max(200),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).nullable().optional(),
  rowVersion,
})

// --- references ---------------------------------------------------------------------------------

const knownTitle = (value: string) => !!jobTitles.find(value) || DESIGNATION_NAMES.has(value)
const knownPerson = (value: string) => !!findEmployee(value) || !!employees.find(value)

/** 422 field messages for ids the mock does not know. */
function badReferences(body: {
  jobTitleId?: string | null | undefined
  designationId?: string | null | undefined
  departmentId?: string | null | undefined
  branchId?: string | null | undefined
  employmentTypeId?: string | null | undefined
  cityId?: string | null | undefined
  openPositionId?: string | null | undefined
  hiringManagerId?: string | null | undefined
  lineManagerId?: string | null | undefined
  referredByEmployeeId?: string | null | undefined
}): Record<string, string> {
  const errors: Record<string, string> = {}
  if (body.jobTitleId && !knownTitle(body.jobTitleId))
    errors.jobTitleId = 'Choose a valid job title.'
  if (body.designationId && !knownTitle(body.designationId)) {
    errors.designationId = 'Choose a valid designation.'
  }
  if (body.departmentId && !DEPARTMENT_NAMES.has(body.departmentId)) {
    errors.departmentId = 'Choose a valid department.'
  }
  if (body.branchId && !branches.find(body.branchId)) errors.branchId = 'Choose a valid branch.'
  // The mock company has no employment types (the lookup is empty).
  if (body.employmentTypeId) errors.employmentTypeId = 'Choose a valid employment type.'
  if (body.cityId && !CITIES.some((city) => city.id === body.cityId))
    errors.cityId = 'Choose a valid city.'
  if (body.openPositionId && !openPositions.find(body.openPositionId)) {
    errors.openPositionId = 'Choose an open position of Manpower Planning.'
  }
  for (const field of ['hiringManagerId', 'lineManagerId', 'referredByEmployeeId'] as const) {
    const person = body[field]
    if (person && !knownPerson(person)) errors[field] = 'Choose a valid employee.'
  }
  return errors
}

// --- openings -----------------------------------------------------------------------------------

function writeOpening(body: OpeningBody, current: OpeningRec | undefined): OpeningRec | Response {
  const errors = badReferences(body)
  const position = body.openPositionId ? openPositions.find(body.openPositionId) : undefined
  const title = filled(body.title) ?? titleName(body.jobTitleId ?? null) ?? position?.title ?? ''
  if (!title) errors.title = 'Give the opening a title (or pick its job title).'
  if (!body.vacancies && !current) errors.vacancies = 'Vacancies are required.'
  if (
    body.experienceFromYears != null &&
    body.experienceToYears != null &&
    body.experienceToYears < body.experienceFromYears
  ) {
    errors.experienceToYears = 'Must be at least the minimum.'
  }
  if (body.salaryFrom != null && body.salaryTo != null && body.salaryTo < body.salaryFrom) {
    errors.salaryTo = 'Must be at least the minimum salary.'
  }
  if (body.postedOn && body.applyBy && body.applyBy < body.postedOn) {
    errors.applyBy = 'Cannot be before the posting date.'
  }
  if (body.applyBy && body.closeOn && body.closeOn < body.applyBy) {
    errors.closeOn = 'Cannot be before the apply-by date.'
  }
  const vacancies = body.vacancies ?? current?.vacancies ?? 1
  if (current) {
    const hired = applications
      .all()
      .filter((row) => row.jobOpeningId === current.id && row.stage === 'hired').length
    if (vacancies < hired)
      errors.vacancies = `${String(hired)} already hired: at least ${String(hired)}.`
  }
  if (Object.keys(errors).length > 0) return invalidFields(errors)

  const all = openings.all()
  const newId = current?.id ?? nextId(all, 1)
  const code = filled(body.code) ?? current?.code ?? `RC-${newId.padStart(4, '0')}`
  if (all.some((row) => row.id !== current?.id && row.code.toLowerCase() === code.toLowerCase())) {
    return refused('Another opening already has this code.', 'code')
  }
  return {
    id: newId,
    code,
    title,
    status: current?.status ?? 'draft',
    openPositionId: body.openPositionId ?? null,
    jobTitleId: body.jobTitleId ?? null,
    designationId: body.designationId ?? null,
    departmentId: body.departmentId ?? null,
    branchId: body.branchId ?? null,
    employmentTypeId: body.employmentTypeId ?? null,
    hiringManagerId: body.hiringManagerId ?? null,
    cityId: body.cityId ?? null,
    workMode: body.workMode ?? null,
    experienceFromYears: body.experienceFromYears ?? null,
    experienceToYears: body.experienceToYears ?? null,
    vacancies,
    postedOn: body.postedOn ?? null,
    applyBy: body.applyBy ?? null,
    closeOn: body.closeOn ?? null,
    salaryFrom: body.salaryFrom ?? null,
    salaryTo: body.salaryTo ?? null,
    isSalaryVisible: body.isSalaryVisible,
    description: filled(body.description),
    requirements: filled(body.requirements),
    publishedAt: current?.publishedAt ?? null,
    closedAt: current?.closedAt ?? null,
    createdAt: current?.createdAt ?? now(),
    createdByName: current?.createdByName ?? ACTOR,
    updatedAt: current ? now() : null,
    rowVersion: nextRowVersion(),
  }
}

const OPENING_STEPS: Record<
  string,
  { from: OpeningRec['status'][]; to: OpeningRec['status']; refusal: string }
> = {
  publish: { from: ['draft'], to: 'open', refusal: 'Only a draft opening can be published.' },
  hold: { from: ['open'], to: 'on_hold', refusal: 'Only an open opening can be put on hold.' },
  close: {
    from: ['open', 'on_hold'],
    to: 'closed',
    refusal: 'This opening is already closed or not published yet.',
  },
  reopen: {
    from: ['on_hold', 'closed'],
    to: 'open',
    refusal: 'Only an opening on hold or closed can be reopened.',
  },
}

const openingHandlers: HttpHandler[] = [
  http.get(apiPath('/recruitment/openings'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const filters = ['status', 'departmentId', 'branchId', 'jobTitleId', 'openPositionId'] as const
    const rows = openings
      .all()
      .filter((row) => !q || `${row.title} ${row.code}`.toLowerCase().includes(q))
      .filter((row) =>
        filters.every((key) => {
          const wanted = url.searchParams.get(key)
          return !wanted || row[key] === wanted
        }),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(openingOut)
    return page(rows, url)
  }),

  http.post(apiPath('/recruitment/openings'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const body = await parse(request, openingBody)
    if (body instanceof Response) return body
    const rec = writeOpening(body, undefined)
    if (rec instanceof Response) return rec
    openings.insert(rec)
    return item(openingOut(rec), 201)
  }),

  http.get(apiPath('/recruitment/openings/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const rec = openings.find(String(params.id))
    return rec ? item(openingOut(rec)) : notFound('Opening')
  }),

  http.put(apiPath('/recruitment/openings/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const current = openings.find(String(params.id))
    if (!current) return notFound('Opening')
    const body = await parse(request, openingBody)
    if (body instanceof Response) return body
    const stale = checkRowVersion(body.rowVersion, current, 'opening')
    if (stale) return stale
    if (current.status === 'closed')
      return refused('A closed opening cannot be edited. Reopen it first.')
    const rec = writeOpening(body, current)
    if (rec instanceof Response) return rec
    openings.update(current.id, rec)
    return item(openingOut(rec))
  }),

  http.delete(apiPath('/recruitment/openings/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const current = openings.find(String(params.id))
    if (!current) return notFound('Opening')
    const stale = checkRowVersion(
      new URL(request.url).searchParams.get('rowVersion'),
      current,
      'opening',
    )
    if (stale) return stale
    if (applications.all().some((row) => row.jobOpeningId === current.id)) {
      return refused('This opening has applications. Close it instead.')
    }
    openings.remove(current.id)
    return noContent()
  }),

  http.post(apiPath('/recruitment/openings/:id/:action'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const step = OPENING_STEPS[String(params.action)]
    if (!step) return notFound('Action')
    const current = openings.find(String(params.id))
    if (!current) return notFound('Opening')
    const body = await parse(request, versionBody)
    if (body instanceof Response) return body
    const stale = checkRowVersion(body.rowVersion, current, 'opening')
    if (stale) return stale
    if (!step.from.includes(current.status)) return refused(step.refusal)
    const rec: OpeningRec = {
      ...current,
      status: step.to,
      postedOn: step.to === 'open' ? (current.postedOn ?? today()) : current.postedOn,
      publishedAt: step.to === 'open' ? (current.publishedAt ?? now()) : current.publishedAt,
      closedAt: step.to === 'closed' ? now() : step.to === 'open' ? null : current.closedAt,
      updatedAt: now(),
      rowVersion: nextRowVersion(),
    }
    openings.update(current.id, rec)
    return item(openingOut(rec))
  }),
]

// --- applicants ---------------------------------------------------------------------------------

function writeApplicant(
  body: ApplicantBody,
  current: ApplicantRec | undefined,
): ApplicantRec | Response {
  const errors = badReferences(body)
  if (body.dateOfBirth && body.dateOfBirth >= today())
    errors.dateOfBirth = 'The date of birth must be in the past.'
  if (body.source === 'referral' && !body.referredByEmployeeId) {
    errors.referredByEmployeeId = 'Say who referred the candidate.'
  }
  if (Object.keys(errors).length > 0) return invalidFields(errors)
  const email = body.email.toLowerCase()
  if (applicants.all().some((row) => row.id !== current?.id && row.email.toLowerCase() === email)) {
    return refused('A candidate with this email already exists.', 'email')
  }
  return {
    id: current?.id ?? nextId(applicants.all(), 101),
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    phone: body.phone ?? null,
    gender: body.gender ?? null,
    dateOfBirth: body.dateOfBirth ?? null,
    cityId: body.cityId ?? null,
    address: body.address ?? null,
    currentEmployer: body.currentEmployer ?? null,
    currentJobTitle: body.currentJobTitle ?? null,
    experienceYears: body.experienceYears ?? null,
    currentSalary: body.currentSalary ?? null,
    expectedSalary: body.expectedSalary ?? null,
    noticePeriodDays: body.noticePeriodDays ?? null,
    highestEducation: body.highestEducation ?? null,
    linkedinUrl: body.linkedinUrl ?? null,
    source: body.source ?? null,
    referredByEmployeeId: body.source === 'referral' ? (body.referredByEmployeeId ?? null) : null,
    cvFileId: body.cvFileId ?? null,
    cvName: body.cvFileId && body.cvFileId === current?.cvFileId ? current.cvName : null,
    notes: filled(body.notes),
    createdAt: current?.createdAt ?? now(),
    createdByName: current?.createdByName ?? ACTOR,
    updatedAt: current ? now() : null,
    rowVersion: nextRowVersion(),
  }
}

const applicantHandlers: HttpHandler[] = [
  http.get(apiPath('/recruitment/applicants'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const source = url.searchParams.get('source')
    const cityId = url.searchParams.get('cityId')
    const rows = applicants
      .all()
      .filter(
        (row) =>
          !q ||
          `${fullName(row)} ${row.email} ${row.phone ?? ''} ${row.currentJobTitle ?? ''}`
            .toLowerCase()
            .includes(q),
      )
      .filter((row) => (!source || row.source === source) && (!cityId || row.cityId === cityId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(applicantOut)
    return page(rows, url)
  }),

  http.post(apiPath('/recruitment/applicants'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const body = await parse(request, applicantBody)
    if (body instanceof Response) return body
    const rec = writeApplicant(body, undefined)
    if (rec instanceof Response) return rec
    applicants.insert(rec)
    return item(applicantOut(rec), 201)
  }),

  http.get(apiPath('/recruitment/applicants/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const rec = applicants.find(String(params.id))
    return rec ? item(applicantDetailOut(rec)) : notFound('Candidate')
  }),

  http.put(apiPath('/recruitment/applicants/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const current = applicants.find(String(params.id))
    if (!current) return notFound('Candidate')
    const body = await parse(request, applicantBody)
    if (body instanceof Response) return body
    const stale = checkRowVersion(body.rowVersion, current, 'candidate')
    if (stale) return stale
    const rec = writeApplicant(body, current)
    if (rec instanceof Response) return rec
    applicants.update(current.id, rec)
    return item(applicantOut(rec))
  }),

  http.delete(apiPath('/recruitment/applicants/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const current = applicants.find(String(params.id))
    if (!current) return notFound('Candidate')
    const stale = checkRowVersion(
      new URL(request.url).searchParams.get('rowVersion'),
      current,
      'candidate',
    )
    if (stale) return stale
    if (applications.all().some((row) => row.applicantId === current.id)) {
      return refused('This candidate has applications. Delete or withdraw those first.')
    }
    applicants.remove(current.id)
    return noContent()
  }),
]

// --- applications -------------------------------------------------------------------------------

function logStage(
  application: ApplicationRec,
  toStage: StageValue,
  remarks: string | null | undefined,
): void {
  const own = history.all().filter((row) => row.applicationId === application.id)
  history.insert({
    id: `${application.id}-${String(own.length)}-${Date.now().toString(36)}`,
    applicationId: application.id,
    fromStage: application.stage === toStage && own.length === 0 ? null : application.stage,
    toStage,
    changedAt: now(),
    changedByName: ACTOR,
    remarks: remarks ?? null,
  })
}

/** Moves an application to `stage`, logging it (nothing when it is there or further on). */
function advance(application: ApplicationRec, stage: StageValue, remarks: string): ApplicationRec {
  const order: StageValue[] = ['applied', 'screening', 'shortlisted', 'interview', 'offer']
  if (!isActive(application) || order.indexOf(application.stage) >= order.indexOf(stage)) {
    return application
  }
  logStage(application, stage, remarks)
  const next: ApplicationRec = {
    ...application,
    stage,
    stageChangedAt: now(),
    updatedAt: now(),
    rowVersion: nextRowVersion(),
  }
  applications.update(application.id, next)
  return next
}

/** The record named in the path, its row version checked, and still in the pipeline. */
function activeApplication(idValue: string, given: string): ApplicationRec | Response {
  const current = applications.find(idValue)
  if (!current) return notFound('Application')
  const stale = checkRowVersion(given, current, 'application')
  if (stale) return stale
  if (!isActive(current)) {
    return refused(`This application is closed (${current.stage}); it cannot change any more.`)
  }
  return current
}

/**
 * Whether an employee code is in use: Talent Management's employees, the employee directory's
 * lookup codes (`EMP-0001` …) and the codes the attendance and scheduling screens show
 * (`Id-001` …), compared without case.
 */
export function employeeCodeTaken(code: string): boolean {
  const wanted = code.trim().toLowerCase()
  return (
    employees.all().some((rec) => rec.code.toLowerCase() === wanted) ||
    DIRECTORY.some(
      (person, index) =>
        codeOf(index).toLowerCase() === wanted ||
        PROFILES[person.id]?.code.toLowerCase() === wanted,
    )
  )
}

function hireEmployee(
  application: ApplicationRec,
  body: z.infer<typeof hireBody>,
): EmployeeRec | Response {
  const applicant = applicants.find(application.applicantId)
  const opening = openings.find(application.jobOpeningId)
  if (!applicant || !opening) return notFound('Application')
  const offer = offers
    .all()
    .find((row) => row.applicationId === application.id && row.status === 'accepted')
  const errors = badReferences(body)
  const branchId = body.branchId ?? offer?.branchId ?? opening.branchId
  if (!branchId) errors.branchId = 'Choose the branch the new employee joins.'
  if (body.cnic && !/^\d{5}-?\d{7}-?\d$/.test(body.cnic))
    errors.cnic = 'Enter the CNIC as 35202-1234567-1.'
  const joiningDate = body.joiningDate ?? offer?.joiningDate ?? today()
  if (body.probationEndDate && body.probationEndDate < joiningDate) {
    errors.probationEndDate = 'Probation cannot end before the joining date.'
  }
  const given = filled(body.code)
  if (given && employeeCodeTaken(given)) {
    errors.code = 'Another employee already has this code.'
  }
  if (Object.keys(errors).length > 0) return invalidFields(errors)
  const hired = applications
    .all()
    .filter((row) => row.jobOpeningId === opening.id && row.stage === 'hired').length
  if (hired >= opening.vacancies) {
    return refused('Every vacancy of this opening is filled. Raise its vacancies first.')
  }
  const people = employees.all()
  const highest = people
    .map((rec) => /^EMP-(\d+)$/.exec(rec.code)?.[1])
    .reduce((max, digits) => Math.max(max, digits ? Number(digits) : 0), 0)
  let next = highest + 1
  while (employeeCodeTaken(`EMP-${String(next).padStart(4, '0')}`)) next += 1
  const code = given ?? `EMP-${String(next).padStart(4, '0')}`
  const departmentId = body.departmentId ?? offer?.departmentId ?? opening.departmentId
  const designationId = body.designationId ?? offer?.designationId ?? opening.designationId
  const jobTitleId = body.jobTitleId ?? offer?.jobTitleId ?? opening.jobTitleId
  const status = body.status ?? 'probation'
  const probationMonths = offer?.probationMonths ?? 3
  const branch = branches.find(branchId ?? '')
  return {
    id: `em_rc${application.id}`,
    code,
    firstName: applicant.firstName,
    lastName: applicant.lastName,
    parentName: null,
    gender: applicant.gender,
    maritalStatus: null,
    religion: null,
    nationality: null,
    dateOfBirth: applicant.dateOfBirth,
    cnic: body.cnic ?? null,
    email: applicant.email,
    phone1: applicant.phone,
    phone2: null,
    homeAddress: applicant.address,
    homeCityId: applicant.cityId,
    photoFileId: null,
    branchId: branchId ?? '',
    locationId: branch?.locationId ?? null,
    areaId: branch?.areaId ?? null,
    departmentId,
    departmentName: departmentName(departmentId),
    divisionId: null,
    divisionName: null,
    costCenterId: null,
    costCenterName: null,
    designationId,
    designationName: titleName(designationId),
    jobTitleId,
    jobTitleName: titleName(jobTitleId),
    gradeId: null,
    gradeName: null,
    jobLevelId: null,
    jobLevelName: null,
    employeeGroupId: null,
    employeeGroupName: null,
    employmentTypeId: null,
    employmentTypeName: null,
    lineManagerId: body.lineManagerId ?? opening.hiringManagerId,
    finalAuthorityId: null,
    status,
    salaryFrequency: offer?.salaryFrequency ?? 'monthly',
    joiningDate,
    confirmationDate: null,
    probationEndDate:
      status === 'probation'
        ? (body.probationEndDate ??
          format(subDays(addMonths(new Date(joiningDate), probationMonths), 1), 'yyyy-MM-dd'))
        : null,
    endDate: null,
    userAccountId: null,
    createdAt: now(),
    updatedAt: null,
    rowVersion: nextEmployeeVersion(),
  }
}

const applicationHandlers: HttpHandler[] = [
  http.get(apiPath('/recruitment/applications'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const params = url.searchParams
    const q = (params.get('q') ?? '').trim().toLowerCase()
    const from = params.get('fromDate')
    const to = params.get('toDate')
    const rows = applications
      .all()
      .map(applicationOut)
      .filter(
        (row) =>
          !q ||
          `${row.applicantName} ${row.applicantEmail} ${row.jobOpeningTitle} ${row.jobOpeningCode}`
            .toLowerCase()
            .includes(q),
      )
      .filter(
        (row) => !params.get('jobOpeningId') || row.jobOpeningId === params.get('jobOpeningId'),
      )
      .filter((row) => !params.get('applicantId') || row.applicantId === params.get('applicantId'))
      .filter((row) => !params.get('stage') || row.stage === params.get('stage'))
      .filter(
        (row) =>
          params.get('activeOnly') !== 'true' ||
          !['hired', 'rejected', 'withdrawn'].includes(row.stage),
      )
      .filter((row) => (!from || row.appliedOn >= from) && (!to || row.appliedOn <= to))
      .sort((a, b) => b.appliedOn.localeCompare(a.appliedOn) || Number(b.id) - Number(a.id))
    return page(rows, url)
  }),

  http.post(apiPath('/recruitment/applications'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const body = await parse(request, applicationBody)
    if (body instanceof Response) return body
    const opening = openings.find(body.jobOpeningId)
    if (!opening) return invalidFields({ jobOpeningId: 'Choose a valid job opening.' })
    if (opening.status !== 'open') {
      return invalidFields({ jobOpeningId: 'This opening is not taking applications.' })
    }
    let applicant: ApplicantRec | undefined
    if (body.applicantId) {
      applicant = applicants.find(body.applicantId)
      if (!applicant) return invalidFields({ applicantId: 'Choose a valid candidate.' })
    } else if (body.applicant) {
      const rec = writeApplicant(body.applicant, undefined)
      if (rec instanceof Response) return rec
      applicant = rec
    } else {
      return invalidFields({ applicantId: 'Choose a candidate or add a new one.' })
    }
    const candidate = applicant
    const twice = applications
      .all()
      .some(
        (row) =>
          row.applicantId === candidate.id && row.jobOpeningId === opening.id && isActive(row),
      )
    if (twice)
      return refused(
        'This candidate already has an open application for this opening.',
        'jobOpeningId',
      )
    if (!body.applicantId) applicants.insert(candidate)
    const rec: ApplicationRec = {
      id: nextId(applications.all(), 501),
      jobOpeningId: opening.id,
      applicantId: candidate.id,
      appliedOn: body.appliedOn ?? today(),
      source: body.source ?? candidate.source,
      coverLetter: filled(body.coverLetter),
      stage: 'applied',
      stageChangedAt: now(),
      rejectionReasonId: null,
      rejectedStage: null,
      remarks: body.remarks ?? null,
      employeeId: null,
      hiredAt: null,
      createdAt: now(),
      createdByName: ACTOR,
      updatedAt: null,
      rowVersion: nextRowVersion(),
    }
    applications.insert(rec)
    history.insert({
      id: `${rec.id}-0`,
      applicationId: rec.id,
      fromStage: null,
      toStage: 'applied',
      changedAt: now(),
      changedByName: ACTOR,
      remarks: body.remarks ?? null,
    })
    return item(applicationDetailOut(rec), 201)
  }),

  http.get(apiPath('/recruitment/applications/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const rec = applications.find(String(params.id))
    return rec ? item(applicationDetailOut(rec)) : notFound('Application')
  }),

  http.delete(apiPath('/recruitment/applications/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const current = applications.find(String(params.id))
    if (!current) return notFound('Application')
    const stale = checkRowVersion(
      new URL(request.url).searchParams.get('rowVersion'),
      current,
      'application',
    )
    if (stale) return stale
    if (current.stage === 'hired') return refused('A hire cannot be deleted.')
    const busy =
      interviews
        .all()
        .some((row) => row.applicationId === current.id && row.status !== 'cancelled') ||
      offers.all().some((row) => row.applicationId === current.id)
    if (busy)
      return refused('This application has interviews or offers. Withdraw or reject it instead.')
    applications.remove(current.id)
    for (const row of history.all().filter((entry) => entry.applicationId === current.id)) {
      history.remove(row.id)
    }
    return noContent()
  }),

  http.patch(apiPath('/recruitment/applications/:id/stage'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const body = await parse(request, stageBody)
    if (body instanceof Response) return body
    const current = activeApplication(String(params.id), body.rowVersion)
    if (current instanceof Response) return current
    if (current.stage === body.stage) {
      return invalidFields({ stage: `The application is already at ${body.stage}.` })
    }
    logStage(current, body.stage, body.remarks)
    const rec: ApplicationRec = {
      ...current,
      stage: body.stage,
      stageChangedAt: now(),
      updatedAt: now(),
      rowVersion: nextRowVersion(),
    }
    applications.update(current.id, rec)
    return item(applicationDetailOut(rec))
  }),

  http.post(apiPath('/recruitment/applications/:id/reject'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const body = await parse(request, rejectBody)
    if (body instanceof Response) return body
    const current = activeApplication(String(params.id), body.rowVersion)
    if (current instanceof Response) return current
    if (body.rejectionReasonId) {
      const reason = reasons.find(body.rejectionReasonId)
      if (!reason?.isActive)
        return invalidFields({ rejectionReasonId: 'Choose an active rejection reason.' })
    }
    logStage(current, 'rejected', body.remarks)
    const rec: ApplicationRec = {
      ...current,
      stage: 'rejected',
      rejectedStage: current.stage,
      rejectionReasonId: body.rejectionReasonId ?? null,
      remarks: body.remarks ?? current.remarks,
      stageChangedAt: now(),
      updatedAt: now(),
      rowVersion: nextRowVersion(),
    }
    applications.update(current.id, rec)
    return item(applicationDetailOut(rec))
  }),

  http.post(apiPath('/recruitment/applications/:id/withdraw'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const body = await parse(request, remarksBody)
    if (body instanceof Response) return body
    const current = activeApplication(String(params.id), body.rowVersion)
    if (current instanceof Response) return current
    logStage(current, 'withdrawn', body.remarks)
    const rec: ApplicationRec = {
      ...current,
      stage: 'withdrawn',
      remarks: body.remarks ?? current.remarks,
      stageChangedAt: now(),
      updatedAt: now(),
      rowVersion: nextRowVersion(),
    }
    applications.update(current.id, rec)
    return item(applicationDetailOut(rec))
  }),

  http.post(apiPath('/recruitment/applications/:id/hire'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const body = await parse(request, hireBody)
    if (body instanceof Response) return body
    const current = activeApplication(String(params.id), body.rowVersion)
    if (current instanceof Response) return current
    const employee = hireEmployee(current, body)
    if (employee instanceof Response) return employee
    employees.insert(employee)
    logStage(current, 'hired', body.remarks)
    const rec: ApplicationRec = {
      ...current,
      stage: 'hired',
      employeeId: employee.id,
      hiredAt: now(),
      remarks: body.remarks ?? current.remarks,
      stageChangedAt: now(),
      updatedAt: now(),
      rowVersion: nextRowVersion(),
    }
    applications.update(current.id, rec)
    return item(applicationDetailOut(rec))
  }),
]

// --- interviews ---------------------------------------------------------------------------------

function checkInterviewers(ids: readonly string[]): Response | null {
  const unknown = ids.find((person) => !knownPerson(person))
  return unknown
    ? invalidFields({ interviewerIds: 'Choose valid employees as interviewers.' })
    : null
}

const scheduledOnly = (rec: InterviewRec, doing: string) =>
  rec.status === 'scheduled' ? null : refused(`Only a scheduled interview can be ${doing}.`)

const interviewHandlers: HttpHandler[] = [
  http.get(apiPath('/recruitment/interviews'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const params = url.searchParams
    const q = (params.get('q') ?? '').trim().toLowerCase()
    const from = params.get('fromDate')
    const to = params.get('toDate')
    const interviewer = params.get('interviewerId')
    const mine = params.get('mine') === 'true'
    const rows = interviews
      .all()
      .filter((row) => !interviewer || row.interviewerIds.includes(interviewer))
      .filter((row) => !mine || row.interviewerIds.includes(ACTOR_EMPLOYEE_ID))
      .filter((row) => {
        const dayOf = localDay(row.scheduledAt)
        return (!from || dayOf >= from) && (!to || dayOf <= to)
      })
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      .map(interviewOut)
      .filter((row) => !params.get('status') || row.status === params.get('status'))
      .filter(
        (row) => !params.get('jobOpeningId') || row.jobOpeningId === params.get('jobOpeningId'),
      )
      .filter(
        (row) => !params.get('applicationId') || row.applicationId === params.get('applicationId'),
      )
      .filter(
        (row) =>
          !q ||
          `${row.applicantName} ${row.jobOpeningTitle} ${row.title}`.toLowerCase().includes(q),
      )
    return page(rows, url)
  }),

  http.post(apiPath('/recruitment/interviews'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const body = await parse(request, interviewBody)
    if (body instanceof Response) return body
    if (!body.applicationId) return invalidFields({ applicationId: 'Choose the application.' })
    const application = applications.find(body.applicationId)
    if (!application) return invalidFields({ applicationId: 'Choose a valid application.' })
    if (!isActive(application)) {
      return refused(`This application is closed (${application.stage}); it cannot be interviewed.`)
    }
    // A minute's grace for the time it takes to send the form.
    if (new Date(body.scheduledAt).getTime() < Date.now() - 60_000) {
      return invalidFields({ scheduledAt: 'Choose a date and time that has not passed.' })
    }
    const people = checkInterviewers(body.interviewerIds)
    if (people) return people
    const rounds = interviews
      .all()
      .filter((row) => row.applicationId === application.id && row.status !== 'cancelled').length
    const rec: InterviewRec = {
      id: nextId(interviews.all(), 801),
      applicationId: application.id,
      roundNo: rounds + 1,
      title: filled(body.title) ?? `Interview round ${String(rounds + 1)}`,
      mode: body.mode,
      scheduledAt: new Date(body.scheduledAt).toISOString(),
      durationMinutes: body.durationMinutes,
      venue: body.venue ?? null,
      status: 'scheduled',
      result: null,
      remarks: filled(body.remarks),
      interviewerIds: [...new Set(body.interviewerIds)],
      createdAt: now(),
      createdByName: ACTOR,
      updatedAt: null,
      rowVersion: nextRowVersion(),
    }
    interviews.insert(rec)
    advance(application, 'interview', 'Interview scheduled')
    return item(interviewDetailOut(rec), 201)
  }),

  http.get(apiPath('/recruitment/interviews/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const rec = interviews.find(String(params.id))
    return rec ? item(interviewDetailOut(rec)) : notFound('Interview')
  }),

  http.put(apiPath('/recruitment/interviews/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const current = interviews.find(String(params.id))
    if (!current) return notFound('Interview')
    const body = await parse(request, interviewBody)
    if (body instanceof Response) return body
    const stale = checkRowVersion(body.rowVersion, current, 'interview')
    if (stale) return stale
    const locked = scheduledOnly(current, 'edited')
    if (locked) return locked
    // A minute's grace for the time it takes to send the form.
    if (new Date(body.scheduledAt).getTime() < Date.now() - 60_000) {
      return invalidFields({ scheduledAt: 'Choose a date and time that has not passed.' })
    }
    const people = checkInterviewers(body.interviewerIds)
    if (people) return people
    const rec: InterviewRec = {
      ...current,
      title: filled(body.title) ?? current.title,
      mode: body.mode,
      scheduledAt: new Date(body.scheduledAt).toISOString(),
      durationMinutes: body.durationMinutes,
      venue: body.venue ?? null,
      remarks: filled(body.remarks),
      interviewerIds: [...new Set(body.interviewerIds)],
      updatedAt: now(),
      rowVersion: nextRowVersion(),
    }
    interviews.update(current.id, rec)
    return item(interviewDetailOut(rec))
  }),

  http.post(apiPath('/recruitment/interviews/:id/cancel'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const current = interviews.find(String(params.id))
    if (!current) return notFound('Interview')
    const body = await parse(request, remarksBody)
    if (body instanceof Response) return body
    const stale = checkRowVersion(body.rowVersion, current, 'interview')
    if (stale) return stale
    const locked = scheduledOnly(current, 'cancelled')
    if (locked) return locked
    const rec: InterviewRec = {
      ...current,
      status: 'cancelled',
      remarks: body.remarks ?? current.remarks,
      updatedAt: now(),
      rowVersion: nextRowVersion(),
    }
    interviews.update(current.id, rec)
    return item(interviewDetailOut(rec))
  }),

  http.post(apiPath('/recruitment/interviews/:id/complete'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const current = interviews.find(String(params.id))
    if (!current) return notFound('Interview')
    const body = await parse(request, completeBody)
    if (body instanceof Response) return body
    const stale = checkRowVersion(body.rowVersion, current, 'interview')
    if (stale) return stale
    const locked = scheduledOnly(current, 'completed')
    if (locked) return locked
    const rec: InterviewRec = {
      ...current,
      status: body.status,
      result: body.status === 'completed' ? (body.result ?? null) : null,
      remarks: body.remarks ?? current.remarks,
      updatedAt: now(),
      rowVersion: nextRowVersion(),
    }
    interviews.update(current.id, rec)
    return item(interviewDetailOut(rec))
  }),

  http.post(apiPath('/recruitment/interviews/:id/evaluations'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const current = interviews.find(String(params.id))
    if (!current) return notFound('Interview')
    const body = await parse(request, evaluationBody)
    if (body instanceof Response) return body
    if (current.status === 'cancelled') return refused('A cancelled interview cannot be evaluated.')
    const employeeId = body.employeeId ?? ACTOR_EMPLOYEE_ID
    if (!current.interviewerIds.includes(employeeId)) {
      return invalidFields({ employeeId: 'Only the interview’s interviewers can evaluate it.' })
    }
    const existing = evaluations
      .all()
      .find((row) => row.interviewId === current.id && row.employeeId === employeeId)
    const rec = {
      id: existing?.id ?? nextId(evaluations.all(), 1),
      interviewId: current.id,
      employeeId,
      rating: body.rating,
      recommendation: body.recommendation,
      strengths: filled(body.strengths),
      concerns: filled(body.concerns),
      comments: filled(body.comments),
      evaluatedAt: now(),
      evaluatedByName: ACTOR,
      rowVersion: nextRowVersion(),
    }
    if (existing) evaluations.update(existing.id, rec)
    else evaluations.insert(rec)
    return item(interviewDetailOut(current))
  }),
]

// --- offers -------------------------------------------------------------------------------------

const OPEN_OFFER = new Set(['draft', 'sent', 'accepted'])

const offerHandlers: HttpHandler[] = [
  http.get(apiPath('/recruitment/offers'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const params = url.searchParams
    const q = (params.get('q') ?? '').trim().toLowerCase()
    const rows = offers
      .all()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(offerOut)
      .filter((row) => !params.get('status') || row.status === params.get('status'))
      .filter(
        (row) => !params.get('jobOpeningId') || row.jobOpeningId === params.get('jobOpeningId'),
      )
      .filter(
        (row) => !params.get('applicationId') || row.applicationId === params.get('applicationId'),
      )
      .filter(
        (row) => !q || `${row.applicantName} ${row.jobOpeningTitle}`.toLowerCase().includes(q),
      )
    return page(rows, url)
  }),

  http.post(apiPath('/recruitment/offers'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const body = await parse(request, offerBody)
    if (body instanceof Response) return body
    if (!body.applicationId) return invalidFields({ applicationId: 'Choose the application.' })
    const application = applications.find(body.applicationId)
    if (!application) return invalidFields({ applicationId: 'Choose a valid application.' })
    if (!isActive(application)) {
      return refused(`This application is closed (${application.stage}); it cannot get an offer.`)
    }
    const errors = badReferences(body)
    if (body.expiresOn && body.expiresOn > body.joiningDate) {
      errors.expiresOn = 'The offer must expire on or before the joining date.'
    }
    if (body.joiningDate < today()) errors.joiningDate = 'Choose today or a later date.'
    if (body.expiresOn && body.expiresOn < today()) {
      errors.expiresOn = 'Choose today or a later date.'
    }
    if (Object.keys(errors).length > 0) return invalidFields(errors)
    if (
      offers
        .all()
        .some(
          (row) =>
            row.applicationId === application.id &&
            OPEN_OFFER.has(row.status) &&
            !offerExpired(row),
        )
    ) {
      return refused('This application already has an open offer. Withdraw it first.')
    }
    const opening = openings.find(application.jobOpeningId)
    const rec: OfferRec = {
      id: nextId(offers.all(), 901),
      applicationId: application.id,
      jobTitleId: body.jobTitleId ?? opening?.jobTitleId ?? null,
      designationId: body.designationId ?? opening?.designationId ?? null,
      departmentId: body.departmentId ?? opening?.departmentId ?? null,
      branchId: body.branchId ?? opening?.branchId ?? null,
      employmentTypeId: body.employmentTypeId ?? null,
      offeredSalary: body.offeredSalary,
      salaryFrequency: body.salaryFrequency,
      joiningDate: body.joiningDate,
      probationMonths: body.probationMonths ?? null,
      expiresOn: body.expiresOn ?? null,
      offerLetterFileId: body.offerLetterFileId ?? null,
      offerLetterName: null,
      status: 'draft',
      sentAt: null,
      respondedAt: null,
      responseRemarks: null,
      remarks: body.remarks ?? null,
      createdAt: now(),
      createdByName: ACTOR,
      updatedAt: null,
      rowVersion: nextRowVersion(),
    }
    offers.insert(rec)
    return item(offerOut(rec), 201)
  }),

  http.get(apiPath('/recruitment/offers/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const rec = offers.find(String(params.id))
    return rec ? item(offerOut(rec)) : notFound('Offer')
  }),

  http.put(apiPath('/recruitment/offers/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const current = offers.find(String(params.id))
    if (!current) return notFound('Offer')
    const body = await parse(request, offerBody)
    if (body instanceof Response) return body
    const stale = checkRowVersion(body.rowVersion, current, 'offer')
    if (stale) return stale
    if (current.status !== 'draft') return refused('Only a draft offer can be edited.')
    const errors = badReferences(body)
    if (body.expiresOn && body.expiresOn > body.joiningDate) {
      errors.expiresOn = 'The offer must expire on or before the joining date.'
    }
    if (body.joiningDate < today()) errors.joiningDate = 'Choose today or a later date.'
    if (body.expiresOn && body.expiresOn < today()) {
      errors.expiresOn = 'Choose today or a later date.'
    }
    if (Object.keys(errors).length > 0) return invalidFields(errors)
    const rec: OfferRec = {
      ...current,
      jobTitleId: body.jobTitleId ?? null,
      designationId: body.designationId ?? null,
      departmentId: body.departmentId ?? null,
      branchId: body.branchId ?? null,
      employmentTypeId: body.employmentTypeId ?? null,
      offeredSalary: body.offeredSalary,
      salaryFrequency: body.salaryFrequency,
      joiningDate: body.joiningDate,
      probationMonths: body.probationMonths ?? null,
      expiresOn: body.expiresOn ?? null,
      offerLetterFileId: body.offerLetterFileId ?? null,
      offerLetterName:
        body.offerLetterFileId && body.offerLetterFileId === current.offerLetterFileId
          ? current.offerLetterName
          : null,
      remarks: body.remarks ?? null,
      updatedAt: now(),
      rowVersion: nextRowVersion(),
    }
    offers.update(current.id, rec)
    return item(offerOut(rec))
  }),

  http.delete(apiPath('/recruitment/offers/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const current = offers.find(String(params.id))
    if (!current) return notFound('Offer')
    const stale = checkRowVersion(
      new URL(request.url).searchParams.get('rowVersion'),
      current,
      'offer',
    )
    if (stale) return stale
    if (current.status !== 'draft')
      return refused('Only a draft offer can be deleted. Withdraw it instead.')
    offers.remove(current.id)
    return noContent()
  }),

  http.post(apiPath('/recruitment/offers/:id/:action'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const action = String(params.action)
    const current = offers.find(String(params.id))
    if (!current) return notFound('Offer')
    if (action === 'respond') {
      const body = await parse(request, respondBody)
      if (body instanceof Response) return body
      const stale = checkRowVersion(body.rowVersion, current, 'offer')
      if (stale) return stale
      if (current.status !== 'sent') return refused('Only a sent offer can be answered.')
      if (offerExpired(current)) return refused('This offer has expired; it cannot be answered.')
      const rec: OfferRec = {
        ...current,
        status: body.decision,
        respondedAt: now(),
        responseRemarks: body.remarks ?? null,
        updatedAt: now(),
        rowVersion: nextRowVersion(),
      }
      offers.update(current.id, rec)
      return item(offerOut(rec))
    }
    if (action !== 'send' && action !== 'withdraw') return notFound('Action')
    const body = await parse(request, remarksBody)
    if (body instanceof Response) return body
    const stale = checkRowVersion(body.rowVersion, current, 'offer')
    if (stale) return stale
    if (action === 'send' && current.status !== 'draft')
      return refused('Only a draft offer can be sent.')
    if (action === 'send' && offerExpired(current)) {
      return refused('This offer has expired. Edit its dates before sending it.')
    }
    if (action === 'withdraw' && current.status !== 'draft' && current.status !== 'sent') {
      return refused('Only a draft or sent offer can be withdrawn.')
    }
    const application = applications.find(current.applicationId)
    if (action === 'send' && application && !isActive(application)) {
      return refused(`This application is closed (${application.stage}).`)
    }
    const rec: OfferRec = {
      ...current,
      status: action === 'send' ? 'sent' : 'withdrawn',
      sentAt: action === 'send' ? now() : current.sentAt,
      remarks: body.remarks ?? current.remarks,
      updatedAt: now(),
      rowVersion: nextRowVersion(),
    }
    offers.update(current.id, rec)
    if (action === 'send' && application) advance(application, 'offer', 'Offer sent')
    return item(offerOut(rec))
  }),
]

// --- settings: rejection reasons ----------------------------------------------------------------

function writeReason(
  body: z.infer<typeof reasonBody>,
  current: ReasonRec | undefined,
): ReasonRec | Response {
  const name = body.name.toLowerCase()
  if (reasons.all().some((row) => row.id !== current?.id && row.name.toLowerCase() === name)) {
    return refused('This reason is already on the list.', 'name')
  }
  const all = reasons.all()
  return {
    id: current?.id ?? nextId(all, 1),
    name: body.name,
    isActive: body.isActive,
    sortOrder:
      body.sortOrder ??
      current?.sortOrder ??
      all.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1,
    createdAt: current?.createdAt ?? now(),
    updatedAt: current ? now() : null,
    rowVersion: nextRowVersion(),
  }
}

const reasonHandlers: HttpHandler[] = [
  http.get(apiPath('/recruitment/settings/rejection-reasons'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const activeOnly = url.searchParams.get('activeOnly') === 'true'
    const rows = reasons
      .all()
      .filter((row) => (!q || row.name.toLowerCase().includes(q)) && (!activeOnly || row.isActive))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map(reasonOut)
    return item(rows)
  }),

  http.post(apiPath('/recruitment/settings/rejection-reasons'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const body = await parse(request, reasonBody)
    if (body instanceof Response) return body
    const rec = writeReason(body, undefined)
    if (rec instanceof Response) return rec
    reasons.insert(rec)
    return item(reasonOut(rec), 201)
  }),

  http.put(apiPath('/recruitment/settings/rejection-reasons/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const current = reasons.find(String(params.id))
    if (!current) return notFound('Rejection reason')
    const body = await parse(request, reasonBody)
    if (body instanceof Response) return body
    const stale = checkRowVersion(body.rowVersion, current, 'rejection reason')
    if (stale) return stale
    const rec = writeReason(body, current)
    if (rec instanceof Response) return rec
    reasons.update(current.id, rec)
    return item(reasonOut(rec))
  }),

  http.delete(
    apiPath('/recruitment/settings/rejection-reasons/:id'),
    async ({ request, params }) => {
      await latency()
      const denied = requireAuth(request)
      if (denied) return denied
      const current = reasons.find(String(params.id))
      if (!current) return notFound('Rejection reason')
      const stale = checkRowVersion(
        new URL(request.url).searchParams.get('rowVersion'),
        current,
        'rejection reason',
      )
      if (stale) return stale
      const used = applications.all().filter((row) => row.rejectionReasonId === current.id).length
      if (used > 0) {
        return refused(
          `${String(used)} rejected application${used === 1 ? '' : 's'} use this reason. Switch it off instead.`,
        )
      }
      reasons.remove(current.id)
      return noContent()
    },
  ),
]

// --- dashboard ----------------------------------------------------------------------------------

function dashboard(year: number, month: number | null): DashboardOutDto {
  const start = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1)
  const end = month ? new Date(year, month, 1) : new Date(year + 1, 0, 1)
  const startDay = format(start, 'yyyy-MM-dd')
  const endDay = format(end, 'yyyy-MM-dd')
  const inPeriod = (iso: string | null) => {
    if (!iso) return false
    const time = new Date(iso).getTime()
    return time >= start.getTime() && time < end.getTime()
  }
  const dayInPeriod = (day: string | null) => !!day && day >= startDay && day < endDay
  const allOpenings = openings.all().map(openingOut)
  const allApplications = applications.all()
  const allInterviews = interviews.all()
  const allHistory = history.all()
  const nowIso = now()
  const upcoming = allInterviews
    .filter((row) => row.status === 'scheduled' && row.scheduledAt >= nowIso)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  const monthOf = (iso: string) => {
    const date = new Date(iso)
    return date.getFullYear() === year ? date.getMonth() + 1 : 0
  }
  const historyIn = (stage: StageValue, monthNo: number) =>
    allHistory.filter((row) => row.toStage === stage && monthOf(row.changedAt) === monthNo).length
  return {
    year,
    month,
    tiles: {
      openOpenings: allOpenings.filter((row) => row.status === 'open').length,
      totalOpenings: allOpenings.filter(
        (row) =>
          row.status !== 'draft' &&
          (row.postedOn ?? '') < endDay &&
          (!row.closedAt || new Date(row.closedAt).getTime() >= start.getTime()),
      ).length,
      openVacancies: allOpenings
        .filter((row) => row.status === 'open')
        .reduce((sum, row) => sum + row.remainingVacancies, 0),
      applications: allApplications.filter((row) => dayInPeriod(row.appliedOn)).length,
      interviews: allInterviews.filter(
        (row) => row.status !== 'cancelled' && inPeriod(row.scheduledAt),
      ).length,
      upcomingInterviews: upcoming.length,
      offersAccepted: offers
        .all()
        .filter((row) => row.status === 'accepted' && inPeriod(row.respondedAt)).length,
      hired: allApplications.filter((row) => row.stage === 'hired' && inPeriod(row.hiredAt)).length,
      rejected: allApplications.filter(
        (row) => row.stage === 'rejected' && inPeriod(row.stageChangedAt),
      ).length,
    },
    jobStatistics: Array.from({ length: 12 }, (_, index) => {
      const monthNo = index + 1
      return {
        monthNo,
        applications: allApplications.filter(
          (row) => monthOf(`${row.appliedOn}T12:00:00`) === monthNo,
        ).length,
        shortlisted: historyIn('shortlisted', monthNo),
        rejected: historyIn('rejected', monthNo),
        hired: historyIn('hired', monthNo),
      }
    }),
    upcomingInterviews: upcoming.slice(0, 6).map((rec) => {
      const out = interviewOut(rec)
      const first = personOf(rec.interviewerIds[0] ?? null)
      return {
        interviewId: out.id,
        applicationId: out.applicationId,
        applicantId: out.applicantId,
        applicantName: out.applicantName,
        applicantEmail: out.applicantEmail,
        applicantPhone: out.applicantPhone,
        applicantCityName: out.applicantCityName,
        jobOpeningId: out.jobOpeningId,
        jobOpeningTitle: out.jobOpeningTitle,
        title: out.title,
        roundNo: out.roundNo,
        mode: out.mode,
        scheduledAt: out.scheduledAt,
        durationMinutes: out.durationMinutes,
        venue: out.venue,
        interviewerNames: out.interviewerNames,
        firstInterviewerName: first?.name ?? null,
        firstInterviewerTitle: first?.jobTitle ?? null,
      }
    }),
    recentActivity: allHistory
      .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
      .slice(0, 8)
      .map((row) => {
        const application = applications.find(row.applicationId)
        const out = application ? applicationOut(application) : null
        return {
          id: row.id,
          applicationId: row.applicationId,
          applicantName: out?.applicantName ?? '',
          jobOpeningTitle: out?.jobOpeningTitle ?? '',
          fromStage: row.fromStage,
          toStage: row.toStage,
          changedAt: row.changedAt,
          changedByName: row.changedByName,
        }
      }),
  }
}

const dashboardHandler = http.get(apiPath('/recruitment/dashboard'), async ({ request }) => {
  await latency()
  const denied = requireAuth(request)
  if (denied) return denied
  const url = new URL(request.url)
  const yearText = url.searchParams.get('year')
  const monthText = url.searchParams.get('month')
  const year = yearText ? Number(yearText) : new Date().getFullYear()
  const month = monthText ? Number(monthText) : null
  const errors: Record<string, string> = {}
  if (!Number.isInteger(year) || year < 2000 || year > 2100) errors.year = 'Year must be 2000–2100.'
  if (month !== null && (!Number.isInteger(month) || month < 1 || month > 12)) {
    errors.month = 'Month must be 1–12.'
  }
  if (Object.keys(errors).length > 0) return invalidFields(errors)
  return item(dashboard(year, month))
})

// --- exports ------------------------------------------------------------------------------------

/** The mock of `/api/recruitment` (registered in `src/mocks/handlers.ts`). */
export const recruitmentHandlers: HttpHandler[] = [
  dashboardHandler,
  ...openingHandlers,
  ...applicantHandlers,
  ...applicationHandlers,
  ...interviewHandlers,
  ...offerHandlers,
  ...reasonHandlers,
]

/** Restores the module's mock tables to their seed data (used between tests). */
export function resetRecruitmentDb(): void {
  resetRecruitmentCollections()
}
