import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import type {
  BenefitEmployee,
  BenefitFile,
  BenefitPlan,
  BenefitsSummary,
  EnrollmentWindow,
  MissingDetail,
  PlanYear,
} from '@/features/benefits'
import type { ApiErrorBody, ApiItem } from '@/types/api'

import { toProfile } from '../attendance/seed'
import { DIRECTORY, findEmployee } from '../employees/seed'
import { mockFileUrl } from '../files/handlers'
import { orgLookupHandlers } from '../manpower-planning/org-lookups'
import { employees as employeeRecords } from '../talent-management/db'
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
  elections,
  enrollmentWindows,
  type FileRec,
  planFiles,
  type PlanRec,
  plans,
  type PlanYearRec,
  planYears,
  resetBenefitsCollections,
  updateRequests,
  type WindowRec,
} from './db'

// The mock of `/api/benefits/*` (backend app/routers/benefits.py) and of the Update Information
// request the Employees tab sends (`POST /employees/{id}/update-requests`): the same routes,
// bodies, statuses and field errors, over the tables in db.ts.

const base = (path: string) => apiPath(`/benefits${path}`)
const ME = 'Administrator'
const now = () => new Date().toISOString().slice(0, 19)
const today = () => new Date().toISOString().slice(0, 10)
const nextVersion = (version: string) => String(Number.parseInt(version, 16) + 1).padStart(16, '0')

const invalid = (field: string, message: string) =>
  errorResponse(422, message, { code: 'VALIDATION_FAILED', fieldErrors: { [field]: message } })
const notFound = (what: string) => errorResponse(404, `${what} not found`, { code: 'NOT_FOUND' })
const conflict = () =>
  errorResponse(409, 'Someone else changed this record. Reload it and try again', {
    code: 'CONFLICT',
  })

async function readBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T> | Response> {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (parsed.success) return parsed.data
  const fieldErrors: Record<string, string> = {}
  for (const issue of parsed.error.issues) {
    fieldErrors[issue.path.map(String).join('.') || 'body'] ??= issue.message
  }
  return HttpResponse.json<ApiErrorBody>(
    { message: 'Some fields need your attention.', code: 'VALIDATION_FAILED', fieldErrors },
    { status: 422 },
  )
}

const ids = z.array(z.coerce.string())
const text = (value: string | null | undefined) => (value?.trim() ? value.trim() : null)
const versionOf = (request: Request) => new URL(request.url).searchParams.get('rowVersion')

// --- shaping ---------------------------------------------------------------------------------

// --- people ----------------------------------------------------------------------------------

/**
 * The sample gaps the Employees tab shows (as drawn): details the benefits carriers need that
 * these people's records are taken to lack. Everyone else's come from their Employees record.
 */
const SAMPLE_GAPS: Record<string, readonly ('dateOfBirth' | 'maritalStatus')[]> = {
  em_omer: ['dateOfBirth', 'maritalStatus'],
  em_maryam: ['maritalStatus'],
}

interface BenefitPerson {
  id: string
  code: string
  name: string
  jobTitleName: string | null
  departmentName: string | null
  dateOfBirth: string | null
  maritalStatus: string | null
}

/** A person of the shared company directory, with the details benefits enrolment needs. */
function personOf(id: string): BenefitPerson | undefined {
  const employee = findEmployee(id)
  if (!employee) return undefined
  const record = employeeRecords.find(id)
  const gaps = SAMPLE_GAPS[id] ?? []
  return {
    id,
    code: toProfile(employee).code,
    name: employee.name,
    jobTitleName: employee.jobTitle,
    departmentName: employee.department,
    dateOfBirth: gaps.includes('dateOfBirth') ? null : (record?.dateOfBirth ?? null),
    maritalStatus: gaps.includes('maritalStatus') ? null : (record?.maritalStatus ?? null),
  }
}

/** Everyone in the company directory (the Employees tab and its count). */
const people = () =>
  DIRECTORY.map((employee) => personOf(employee.id)).filter(
    (person): person is BenefitPerson => person !== undefined,
  )

const missingOf = (person: BenefitPerson): MissingDetail[] => [
  ...(person.dateOfBirth ? [] : (['date_of_birth'] as const)),
  ...(person.maritalStatus ? [] : (['marital_status'] as const)),
]

function toPlanYear(rec: PlanYearRec): PlanYear {
  const mine = elections.all().filter((election) => election.planYearId === rec.id)
  const count = (status: string) => mine.filter((election) => election.status === status).length
  return {
    ...rec,
    status: today() < rec.startDate ? 'upcoming' : today() > rec.endDate ? 'ended' : 'active',
    planCount: rec.planIds.length,
    windowCount: enrollmentWindows.all().filter((window) => window.planYearId === rec.id).length,
    pending: count('pending'),
    approved: count('approved'),
    incomplete: count('incomplete'),
    missingInformation: people().filter((person) => missingOf(person).length > 0).length,
  }
}

function toPlan(rec: PlanRec): BenefitPlan {
  const chosen = (status: string) =>
    elections
      .all()
      .filter((election) => election.status === status && election.planIds.includes(rec.id)).length
  return {
    ...rec,
    enrolled: chosen('approved'),
    pending: chosen('pending'),
    fileCount: planFiles.all().filter((file) => file.planId === rec.id).length,
    planYearIds: planYears
      .all()
      .filter((year) => year.planIds.includes(rec.id))
      .map((year) => year.id),
  }
}

function toWindow(rec: WindowRec): EnrollmentWindow {
  return {
    ...rec,
    planYearName: planYears.find(rec.planYearId)?.name ?? '',
    status: today() <= rec.closesOn ? 'open' : 'closed',
    electionCount: elections.all().filter((election) => election.enrollmentWindowId === rec.id)
      .length,
  }
}

function toFile(rec: FileRec): BenefitFile {
  const plan = plans.find(rec.planId)
  return {
    ...rec,
    planName: plan?.name ?? '',
    category: plan?.category ?? 'others',
    file: { id: rec.fileId, name: rec.fileName, url: mockFileUrl(rec.fileId) },
  }
}

// --- bodies ----------------------------------------------------------------------------------

const planYearBody = z.object({
  name: z.string().trim().min(1).max(200),
  startDate: z.string().min(10),
  endDate: z.string().min(10),
  planIds: ids.max(200).default([]),
  newHireStart: z.enum(['immediately', 'waiting_period', 'per_employee']).default('immediately'),
  waitingPeriodDays: z.coerce.number().int().min(1).max(365).nullish(),
  electionPeriod: z.coerce.number().int().min(1).max(365).default(30),
  electionUnit: z.enum(['day', 'week', 'month']).default('day'),
  rowVersion: z.string().nullish(),
})

const planBody = z.object({
  category: z.enum(['medical', 'dental', 'vision', 'retirement', 'hsa', 'life', 'others']),
  name: z.string().trim().min(1).max(200),
  planType: z.string().max(100).nullish(),
  planTypeRef: z.string().max(50).nullish(),
  carrier: z.string().max(200).nullish(),
  startDate: z.string().min(10),
  endDate: z.string().min(10),
  description: z.string().max(4000).nullish(),
  status: z.enum(['active', 'inactive']).default('active'),
  rowVersion: z.string().nullish(),
})

const windowBody = z.object({
  planYearId: z.coerce.string().min(1),
  kind: z.enum(['open_enrollment', 'life_event', 'new_hire']).default('open_enrollment'),
  name: z.string().trim().min(1).max(200),
  effectiveDate: z.string().min(10),
  closesOn: z.string().min(10),
  description: z.string().max(4000).nullish(),
  planIds: ids.min(1).max(200),
  employeeIds: ids.max(5000).default([]),
  rowVersion: z.string().nullish(),
})

const updateRequestBody = z.object({
  changes: z.object({
    dateOfBirth: z.string().min(10).nullish(),
    maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).nullish(),
    homeAddress: z.string().max(500).nullish(),
  }),
  remarks: z.string().max(2000).nullish(),
})

// --- handlers ----------------------------------------------------------------------------------

export const benefitsHandlers = [
  ...orgLookupHandlers,

  http.get(base('/summary'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    return HttpResponse.json<ApiItem<BenefitsSummary>>({
      data: {
        planYears: planYears.all().length,
        plans: plans.all().length,
        enrollmentWindows: enrollmentWindows.all().length,
        employees: people().length,
      },
    })
  }),

  // Plan years
  http.get(base('/plan-years'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const status = url.searchParams.get('status')
    const rows = planYears
      .all()
      .map(toPlanYear)
      .filter(
        (row) => (!q || row.name.toLowerCase().includes(q)) && (!status || row.status === status),
      )
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json(paginate(rows, page, pageSize))
  }),

  http.get(base('/plan-years/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const rec = planYears.find(String(params.id))
    if (!rec) return notFound('Plan year')
    return HttpResponse.json<ApiItem<PlanYear>>({ data: toPlanYear(rec) })
  }),

  http.post(base('/plan-years'), async ({ request }) => savePlanYear(request, null)),
  http.put(base('/plan-years/:id'), async ({ request, params }) =>
    savePlanYear(request, String(params.id)),
  ),

  http.delete(base('/plan-years/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const rec = planYears.find(String(params.id))
    if (!rec) return notFound('Plan year')
    if (versionOf(request) && versionOf(request) !== rec.rowVersion) return conflict()
    const mine = elections.all().filter((election) => election.planYearId === rec.id)
    if (mine.some((election) => election.status === 'approved')) {
      return errorResponse(409, 'This plan year has approved elections; it cannot be deleted.', {
        code: 'PLAN_YEAR_IN_USE',
      })
    }
    for (const election of mine) elections.remove(election.id)
    for (const window of enrollmentWindows.all().filter((item) => item.planYearId === rec.id)) {
      enrollmentWindows.remove(window.id)
    }
    planYears.remove(rec.id)
    return new HttpResponse(null, { status: 204 })
  }),

  // Plans
  http.get(base('/plans'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const category = url.searchParams.get('category')
    const yearId = url.searchParams.get('planYearId')
    const status = url.searchParams.get('status')
    const rows = plans
      .all()
      .map(toPlan)
      .filter(
        (row) =>
          (!q || row.name.toLowerCase().includes(q)) &&
          (!category || row.category === category) &&
          (!yearId || row.planYearIds.includes(yearId)) &&
          (!status || row.status === status),
      )
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json(paginate(rows, page, pageSize))
  }),

  http.post(base('/plans/:id/duplicate'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const rec = plans.find(String(params.id))
    if (!rec) return notFound('Plan')
    const copy: PlanRec = {
      ...rec,
      id: createId('bp'),
      name: `${rec.name} (copy)`,
      createdAt: now(),
      createdByName: ME,
      updatedAt: null,
      rowVersion: '0000000000000001',
    }
    plans.insert(copy)
    return HttpResponse.json<ApiItem<BenefitPlan>>({ data: toPlan(copy) }, { status: 201 })
  }),

  http.post(base('/plans/:id/files'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const plan = plans.find(String(params.id))
    if (!plan) return notFound('Plan')
    const body = await readBody(request, z.object({ fileId: z.coerce.string().min(1) }))
    if (body instanceof Response) return body
    // The shared files mock keeps the upload's name to itself: the mock names it by its id.
    const rec: FileRec = {
      id: createId('at'),
      fileId: body.fileId,
      fileName: `${body.fileId}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: null,
      planId: plan.id,
      createdAt: now(),
      rowVersion: '0000000000000001',
    }
    planFiles.insert(rec)
    return HttpResponse.json<ApiItem<BenefitFile>>({ data: toFile(rec) }, { status: 201 })
  }),

  http.get(base('/plans/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const rec = plans.find(String(params.id))
    if (!rec) return notFound('Plan')
    return HttpResponse.json<ApiItem<BenefitPlan>>({ data: toPlan(rec) })
  }),

  http.post(base('/plans'), async ({ request }) => savePlan(request, null)),
  http.put(base('/plans/:id'), async ({ request, params }) => savePlan(request, String(params.id))),

  http.delete(base('/plans/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const rec = plans.find(String(params.id))
    if (!rec) return notFound('Plan')
    if (versionOf(request) && versionOf(request) !== rec.rowVersion) return conflict()
    // Elected (approved or waiting): the same count the list shows as enrolled / pending.
    if (
      elections
        .all()
        .some(
          (election) =>
            (election.status === 'approved' || election.status === 'pending') &&
            election.planIds.includes(rec.id),
        )
    ) {
      return errorResponse(409, 'People have elected this plan; it cannot be deleted.', {
        code: 'PLAN_IN_USE',
      })
    }
    for (const year of planYears.all().filter((item) => item.planIds.includes(rec.id))) {
      planYears.update(year.id, { ...year, planIds: year.planIds.filter((id) => id !== rec.id) })
    }
    for (const file of planFiles.all().filter((item) => item.planId === rec.id)) {
      planFiles.remove(file.id)
    }
    plans.remove(rec.id)
    return new HttpResponse(null, { status: 204 })
  }),

  // Files
  http.get(base('/files'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const planId = url.searchParams.get('planId')
    const yearId = url.searchParams.get('planYearId')
    const offered = yearId ? (planYears.find(yearId)?.planIds ?? []) : null
    const rows = planFiles
      .all()
      .filter(
        (file) =>
          (!planId || file.planId === planId) &&
          (!offered || offered.includes(file.planId)) &&
          (!q || file.fileName.toLowerCase().includes(q)),
      )
      .map(toFile)
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json(paginate(rows, page, pageSize))
  }),

  http.delete(base('/files/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const rec = planFiles.find(String(params.id))
    if (!rec) return notFound('File')
    if (versionOf(request) && versionOf(request) !== rec.rowVersion) return conflict()
    planFiles.remove(rec.id)
    return new HttpResponse(null, { status: 204 })
  }),

  // Enrollment windows
  http.get(base('/enrollment-windows'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const yearId = url.searchParams.get('planYearId')
    const kind = url.searchParams.get('kind')
    const status = url.searchParams.get('status')
    const rows = enrollmentWindows
      .all()
      .map(toWindow)
      .filter(
        (row) =>
          (!q || row.name.toLowerCase().includes(q)) &&
          (!yearId || row.planYearId === yearId) &&
          (!kind || row.kind === kind) &&
          (!status || row.status === status),
      )
      .sort(
        (a, b) =>
          Number(b.status === 'open') - Number(a.status === 'open') ||
          a.closesOn.localeCompare(b.closesOn),
      )
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json(paginate(rows, page, pageSize))
  }),

  http.post(base('/enrollment-windows'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const body = await readBody(request, windowBody)
    if (body instanceof Response) return body
    const year = planYears.find(body.planYearId)
    if (!year) return invalid('planYearId', 'Choose the plan year.')
    if (body.effectiveDate < year.startDate || body.effectiveDate > year.endDate) {
      return invalid('effectiveDate', 'The effective date must fall in the plan year.')
    }
    // A new window starts today or later and closes inside its plan year, on a day still to come.
    if (body.effectiveDate < today()) {
      return invalid('effectiveDate', 'Choose today or a later day.')
    }
    if (body.closesOn < today()) return invalid('closesOn', 'Choose today or a later day.')
    if (body.closesOn > year.endDate) {
      return invalid('closesOn', 'The last day of enrollment must fall in the plan year.')
    }
    if (body.planIds.some((planId) => !year.planIds.includes(planId))) {
      return invalid('planIds', 'Choose plans offered in the plan year.')
    }
    const rec: WindowRec = {
      id: createId('ew'),
      name: body.name.trim(),
      kind: body.kind,
      planYearId: year.id,
      effectiveDate: body.effectiveDate,
      closesOn: body.closesOn,
      description: text(body.description),
      planIds: body.planIds,
      employeeIds: body.employeeIds,
      createdAt: now(),
      createdByName: ME,
      updatedAt: null,
      rowVersion: '0000000000000001',
    }
    enrollmentWindows.insert(rec)
    return HttpResponse.json<ApiItem<EnrollmentWindow>>({ data: toWindow(rec) }, { status: 201 })
  }),

  http.delete(base('/enrollment-windows/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const rec = enrollmentWindows.find(String(params.id))
    if (!rec) return notFound('Enrollment window')
    if (versionOf(request) && versionOf(request) !== rec.rowVersion) return conflict()
    enrollmentWindows.remove(rec.id)
    return new HttpResponse(null, { status: 204 })
  }),

  // Employees tab
  http.get(base('/employees'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const yearId = url.searchParams.get('planYearId')
    const missingOnly = url.searchParams.get('missingOnly') === 'true'
    const rows: BenefitEmployee[] = people()
      .filter(
        (person) =>
          (!q || `${person.name} ${person.code}`.toLowerCase().includes(q)) &&
          (!missingOnly || missingOf(person).length > 0),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((person) => {
        const election = yearId
          ? elections
              .all()
              .find((item) => item.employeeId === person.id && item.planYearId === yearId)
          : undefined
        return {
          id: person.id,
          code: person.code,
          name: person.name,
          jobTitleName: person.jobTitleName,
          departmentName: person.departmentName,
          dateOfBirth: person.dateOfBirth,
          maritalStatus: person.maritalStatus,
          missing: missingOf(person),
          electionId: election?.id ?? null,
          electionStatus: election?.status ?? null,
        }
      })
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json(paginate(rows, page, pageSize))
  }),

  // Update Information (Employees module): a request HR approves.
  http.post(apiPath('/employees/:id/update-requests'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const person = personOf(String(params.id))
    if (!person) return undefined
    const body = await readBody(request, updateRequestBody)
    if (body instanceof Response) return body
    const changes = Object.fromEntries(
      Object.entries(body.changes).filter(([, value]) => typeof value === 'string'),
    ) as Record<string, string>
    if (Object.keys(changes).length === 0) return invalid('changes', 'Ask for at least one change.')
    const rec = {
      id: createId('ur'),
      employeeId: person.id,
      changes,
      status: 'pending' as const,
      createdAt: now(),
    }
    updateRequests.insert(rec)
    return HttpResponse.json(
      {
        data: {
          ...rec,
          employeeCode: person.code,
          employeeName: person.name,
          previous: { dateOfBirth: person.dateOfBirth, maritalStatus: person.maritalStatus },
          remarks: body.remarks ?? null,
          rowVersion: '0000000000000001',
        },
      },
      { status: 201 },
    )
  }),
]

// --- handler bodies --------------------------------------------------------------------------

async function savePlanYear(request: Request, yearId: string | null) {
  await latency()
  const denied = requireAuth(request)
  if (denied) return denied
  const current = yearId ? planYears.find(yearId) : undefined
  if (yearId && !current) return notFound('Plan year')
  const body = await readBody(request, planYearBody)
  if (body instanceof Response) return body
  if (current && body.rowVersion !== current.rowVersion) return conflict()
  if (body.endDate <= body.startDate) {
    return invalid('endDate', 'The end date must be after the start date.')
  }
  if (body.newHireStart === 'waiting_period' && !body.waitingPeriodDays) {
    return invalid('waitingPeriodDays', 'Enter the waiting period in days.')
  }
  const name = body.name.trim()
  if (
    planYears
      .all()
      .some((rec) => rec.id !== yearId && rec.name.toLowerCase() === name.toLowerCase())
  ) {
    return errorResponse(409, 'A plan year with this name already exists.', {
      code: 'PLAN_YEAR_DUPLICATE',
      fieldErrors: { name: 'A plan year with this name already exists.' },
    })
  }
  if (body.planIds.some((planId) => !plans.find(planId))) {
    return invalid('planIds', 'A chosen plan was not found.')
  }
  // Plan years do not overlap: a person is covered by one plan year at a time.
  const overlap = planYears
    .all()
    .find(
      (rec) => rec.id !== yearId && body.startDate <= rec.endDate && body.endDate >= rec.startDate,
    )
  if (overlap) {
    const message = `These dates overlap ${overlap.name} (${overlap.startDate} to ${overlap.endDate}). Plan years cannot overlap.`
    return errorResponse(409, message, {
      code: 'PLAN_YEAR_OVERLAP',
      fieldErrors: { startDate: message },
    })
  }
  const saved: PlanYearRec = {
    id: current?.id ?? createId('by'),
    name,
    startDate: body.startDate,
    endDate: body.endDate,
    newHireStart: body.newHireStart,
    waitingPeriodDays:
      body.newHireStart === 'waiting_period' ? (body.waitingPeriodDays ?? null) : null,
    electionPeriod: body.electionPeriod,
    electionUnit: body.electionUnit,
    planIds: [...new Set(body.planIds)],
    createdAt: current?.createdAt ?? now(),
    createdByName: current?.createdByName ?? ME,
    updatedAt: current ? now() : null,
    rowVersion: current ? nextVersion(current.rowVersion) : '0000000000000001',
  }
  if (current) planYears.update(saved.id, saved)
  else planYears.insert(saved)
  return HttpResponse.json<ApiItem<PlanYear>>(
    { data: toPlanYear(saved) },
    { status: current ? 200 : 201 },
  )
}

async function savePlan(request: Request, planId: string | null) {
  await latency()
  const denied = requireAuth(request)
  if (denied) return denied
  const current = planId ? plans.find(planId) : undefined
  if (planId && !current) return notFound('Plan')
  const body = await readBody(request, planBody)
  if (body instanceof Response) return body
  if (current && body.rowVersion !== current.rowVersion) return conflict()
  if (body.endDate < body.startDate) {
    return invalid('endDate', 'The end date cannot be before the start date.')
  }
  const name = body.name.trim()
  if (
    plans.all().some((rec) => rec.id !== planId && rec.name.toLowerCase() === name.toLowerCase())
  ) {
    return errorResponse(409, 'A plan with this name already exists.', {
      code: 'BENEFIT_PLAN_DUPLICATE',
      fieldErrors: { name: 'A plan with this name already exists.' },
    })
  }
  const saved: PlanRec = {
    id: current?.id ?? createId('bp'),
    category: body.category,
    name,
    planType: text(body.planType),
    planTypeRef: text(body.planTypeRef),
    carrier: text(body.carrier),
    startDate: body.startDate,
    endDate: body.endDate,
    description: text(body.description),
    status: body.status,
    createdAt: current?.createdAt ?? now(),
    createdByName: current?.createdByName ?? ME,
    updatedAt: current ? now() : null,
    rowVersion: current ? nextVersion(current.rowVersion) : '0000000000000001',
  }
  if (current) plans.update(saved.id, saved)
  else plans.insert(saved)
  return HttpResponse.json<ApiItem<BenefitPlan>>(
    { data: toPlan(saved) },
    { status: current ? 200 : 201 },
  )
}

export function resetBenefitsDb(): void {
  resetBenefitsCollections()
}
