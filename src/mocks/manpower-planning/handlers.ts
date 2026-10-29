import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import type {
  Budget,
  BudgetDuration,
  EmployeePosition,
  ImportError,
  OpenPosition,
  Plan,
  PlanDetail,
  PlanLine,
  PositionTitle,
  SalaryRange,
} from '@/features/manpower-planning'
import { monthsBetween } from '@/features/manpower-planning'
import type { ApiErrorBody, ApiItem } from '@/types/api'

import { DEMO_USER } from '../auth/handlers'
import { mockFileUrl } from '../files/handlers'
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
  type BudgetRec,
  budgets,
  type DurationRec,
  durations,
  type LineRec,
  openPositions,
  type OpenRec,
  type PlanRec,
  plans,
  type PositionRec,
  positions,
  type RangeRec,
  resetManpowerCollections,
  salaryRanges,
} from './db'
import {
  BRANCHES,
  COST_CENTERS,
  DEPARTMENTS,
  DIVISIONS,
  EMPLOYEE_GROUPS,
  findPerson,
  GRADES,
  JOB_TITLES,
  orgLookupHandlers,
  orgName,
} from './org-lookups'

// The mock of `/api/manpower/*` (backend app/routers/manpower.py): the same routes, bodies,
// field errors and rules (pricing, budgets per position title and department, locks, open
// positions released on approval), over the tables in db.ts.

const base = (path: string) => apiPath(`/manpower${path}`)
/** The caller: the demo account (the mock has one user). */
const ME = DEMO_USER.name
/** A UTC stamp with its `Z`, so the page shows it in the viewer's time zone. */
const now = () => new Date().toISOString()
const today = () => new Date().toISOString().slice(0, 10)
const nextVersion = (version: string) => String(Number.parseInt(version, 16) + 1).padStart(16, '0')

const invalid = (field: string, message: string) =>
  errorResponse(422, message, { code: 'VALIDATION_FAILED', fieldErrors: { [field]: message } })
const notFound = (what: string) => errorResponse(404, `${what} not found`, { code: 'NOT_FOUND' })
const conflict = (message = 'Someone else changed this record. Reload it and try again') =>
  errorResponse(409, message, { code: 'CONFLICT' })

/** Pydantic-like body check: the first problem as a 422 with its field. */
async function readBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T> | Response> {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (parsed.success) return parsed.data
  const fieldErrors: Record<string, string> = {}
  for (const issue of parsed.error.issues) {
    const path = issue.path
      .map((part, index) =>
        typeof part === 'number' ? `[${String(part)}]` : index ? `.${String(part)}` : String(part),
      )
      .join('')
    fieldErrors[path || 'body'] ??= issue.message
  }
  return HttpResponse.json<ApiErrorBody>(
    { message: 'Some fields need your attention.', code: 'VALIDATION_FAILED', fieldErrors },
    { status: 422 },
  )
}

const id = z.coerce.string().min(1)
const optionalId = z.coerce.string().nullish()
const money = z.coerce.number()

/** A trimmed text, or null when blank. */
const text = (value: string | null | undefined) => (value?.trim() ? value.trim() : null)

const versionOf = (request: Request) => new URL(request.url).searchParams.get('rowVersion')

function textFilter(url: URL) {
  return (url.searchParams.get('q') ?? '').trim().toLowerCase()
}

// --- shaping ---------------------------------------------------------------------------------

function toDuration(rec: DurationRec): BudgetDuration {
  return {
    ...rec,
    planCount: plans.all().filter((plan) => plan.budgetDurationId === rec.id).length,
    budgetCount: budgets.all().filter((budget) => budget.budgetDurationId === rec.id).length,
  }
}

/** The band in force today (the latest range from a date not after today). */
function bandOf(positionId: string): RangeRec | undefined {
  return (
    salaryRanges
      .all()
      .filter((range) => range.positionId === positionId && range.effectiveDate <= today())
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0] ??
    salaryRanges.all().find((range) => range.positionId === positionId)
  )
}

function toPosition(rec: PositionRec): EmployeePosition {
  const band = bandOf(rec.id)
  const reportsTo = rec.reportsToId ? positions.find(rec.reportsToId) : undefined
  return {
    ...rec,
    jobTitleName: orgName.jobTitle(rec.jobTitleId) ?? '',
    branchName: orgName.branch(rec.branchId) ?? '',
    employeeGroupName: orgName.group(rec.employeeGroupId) ?? '',
    divisionName: orgName.division(rec.divisionId),
    departmentName: orgName.department(rec.departmentId),
    subDepartmentName: orgName.department(rec.subDepartmentId),
    costCenterName: orgName.costCenter(rec.costCenterId),
    gradeName: orgName.grade(rec.gradeId),
    reportsToCode: reportsTo?.code ?? null,
    reportsToTitle: reportsTo ? orgName.jobTitle(reportsTo.jobTitleId) : null,
    employeeName: findPerson(rec.employeeId)?.name ?? null,
    minSalary: band?.minSalary ?? null,
    maxSalary: band?.maxSalary ?? null,
  }
}

function toBudget(rec: BudgetRec): Budget {
  const duration = durations.find(rec.budgetDurationId)
  return {
    ...rec,
    budgetDurationName: duration?.name ?? '',
    planTitle: rec.manpowerPlanId ? (plans.find(rec.manpowerPlanId)?.title ?? null) : null,
    jobTitleName: orgName.jobTitle(rec.jobTitleId),
    departmentName: orgName.department(rec.departmentId),
    decidedByUserId: rec.decidedByName ? 'u_admin' : null,
    openPositionCount: openPositions.all().filter((open) => open.eBudgetId === rec.id).length,
  }
}

/** A line's month and year, as the procedures price them. */
function priceOf(line: LineRec) {
  const months = monthsBetween(line.startDate, line.endDate)
  const totalSalary =
    line.kind === 'new_position'
      ? ((line.maxSalary ?? 0) + line.totalAllowance) * line.headcount
      : (line.monthlySalary ?? 0) + line.totalAllowance
  return { months, totalSalary, annualGross: totalSalary * months }
}

function toLine(rec: LineRec, index: number): PlanLine {
  const position = rec.positionId ? positions.find(rec.positionId) : undefined
  const person = findPerson(rec.employeeId)
  return {
    ...rec,
    sortOrder: index,
    positionCode: position?.code ?? null,
    jobTitleName: orgName.jobTitle(position?.jobTitleId ?? person?.jobTitleId),
    employeeCode: person?.code ?? null,
    employeeName: person?.name ?? null,
    departmentName: orgName.department(position?.departmentId ?? person?.departmentId),
    branchName: orgName.branch(position?.branchId ?? person?.branchId),
    ...priceOf(rec),
  }
}

function toPlan(rec: PlanRec): Plan {
  const duration = durations.find(rec.budgetDurationId)
  const mine = budgets.all().filter((budget) => budget.manpowerPlanId === rec.id)
  const priced = rec.lines.map(priceOf)
  const approved = mine.filter((budget) => budget.status === 'approved').length
  return {
    id: rec.id,
    title: rec.title,
    budgetDurationId: rec.budgetDurationId,
    divisionId: rec.divisionId,
    branchId: rec.branchId,
    departmentId: rec.departmentId,
    subDepartmentId: rec.subDepartmentId,
    employeeGroupId: rec.employeeGroupId,
    description: rec.description,
    status: rec.status,
    submittedAt: rec.submittedAt,
    createdAt: rec.createdAt,
    createdByName: rec.createdByName,
    updatedAt: rec.updatedAt,
    updatedByName: rec.updatedByName,
    rowVersion: rec.rowVersion,
    budgetDurationName: duration?.name ?? '',
    isCurrent: duration?.isCurrent ?? false,
    divisionName: orgName.division(rec.divisionId),
    branchName: orgName.branch(rec.branchId),
    departmentName: orgName.department(rec.departmentId),
    subDepartmentName: orgName.department(rec.subDepartmentId),
    employeeGroupName: orgName.group(rec.employeeGroupId),
    monthlyAmount: priced.reduce((sum, line) => sum + line.totalSalary, 0),
    annualAmount: priced.reduce((sum, line) => sum + line.annualGross, 0),
    hasNewPositions: rec.lines.some((line) => line.kind === 'new_position'),
    hasExistingPositions: rec.lines.some((line) => line.kind === 'existing_employee'),
    budgetCount: mine.length,
    approvedBudgetCount: approved,
    isLocked: approved > 0,
  }
}

function toPlanDetail(rec: PlanRec): PlanDetail {
  return {
    ...toPlan(rec),
    lines: rec.lines.map(toLine),
    budgets: budgets
      .all()
      .filter((budget) => budget.manpowerPlanId === rec.id)
      .map(toBudget),
    files: rec.files.map((file) => ({
      attachmentId: `at_${file.id}`,
      ...file,
      createdAt: rec.createdAt,
      url: mockFileUrl(file.id),
    })),
  }
}

function toOpen(rec: OpenRec): OpenPosition {
  const budget = budgets.find(rec.eBudgetId)
  const position = rec.positionId ? positions.find(rec.positionId) : undefined
  return {
    ...rec,
    budgetTitle: budget?.title ?? '',
    manpowerPlanId: budget?.manpowerPlanId ?? null,
    planTitle: budget?.manpowerPlanId ? (plans.find(budget.manpowerPlanId)?.title ?? null) : null,
    positionCode: position?.code ?? null,
    jobTitleName: orgName.jobTitle(rec.jobTitleId),
    departmentName: orgName.department(rec.departmentId),
    branchName: orgName.branch(rec.branchId),
    jdFileId: rec.jdFile?.id ?? null,
    jdFile: rec.jdFile
      ? { id: rec.jdFile.id, name: rec.jdFile.name, url: mockFileUrl(rec.jdFile.id) }
      : null,
  }
}

/** A plan's status follows its budgets: any rejected, all approved, else pending. */
function refreshPlanStatus(planId: string | null) {
  if (!planId) return
  const plan = plans.find(planId)
  if (!plan) return
  const mine = budgets.all().filter((budget) => budget.manpowerPlanId === planId)
  const status = mine.some((budget) => budget.status === 'rejected')
    ? 'rejected'
    : mine.length > 0 && mine.every((budget) => budget.status === 'approved')
      ? 'approved'
      : 'pending'
  plans.update(planId, { ...plan, status })
}

// --- bodies ----------------------------------------------------------------------------------

const durationBody = z.object({
  name: z.string().trim().min(1).max(200),
  startDate: z.string().min(10),
  endDate: z.string().min(10),
  isCurrent: z.boolean().default(false),
  rowVersion: z.string().nullish(),
})

const positionBody = z.object({
  code: z.string().max(30).nullish(),
  jobTitleId: id,
  branchId: id,
  employeeGroupId: id,
  divisionId: optionalId,
  departmentId: optionalId,
  subDepartmentId: optionalId,
  costCenterId: optionalId,
  gradeId: optionalId,
  reportsToId: optionalId,
  employeeId: optionalId,
  status: z.enum(['active', 'inactive']).default('active'),
  minSalary: money.min(0),
  maxSalary: money.positive(),
  rowVersion: z.string().nullish(),
})

const lineBody = z.object({
  kind: z.enum(['new_position', 'existing_employee']),
  positionId: optionalId,
  employeeId: optionalId,
  headcount: z.coerce.number().int().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  minSalary: money.nullish(),
  maxSalary: money.nullish(),
  monthlySalary: money.nullish(),
  totalAllowance: money.nullish(),
})

const planBody = z.object({
  title: z.string().trim().min(1).max(200),
  budgetDurationId: id,
  divisionId: optionalId,
  branchId: optionalId,
  departmentId: optionalId,
  subDepartmentId: optionalId,
  employeeGroupId: optionalId,
  description: z.string().max(4000).nullish(),
  lines: z.array(lineBody).max(500),
  fileIds: z.array(z.coerce.string()).max(20).nullish(),
  rowVersion: z.string().nullish(),
})

const budgetBody = z.object({
  title: z.string().max(200).nullish(),
  budgetDurationId: id,
  jobTitleId: optionalId,
  departmentId: optionalId,
  amount: money.positive(),
  totalPositions: z.coerce.number().int().min(0).default(0),
  startDate: z.string().min(10),
  endDate: z.string().min(10),
  rowVersion: z.string().nullish(),
})

const decisionBody = z.object({ remarks: z.string().max(2000).nullish(), rowVersion: z.string() })

const openBody = z.object({
  totalPositions: z.coerce.number().int().min(1),
  endDate: z.string().nullish(),
  jdFileId: optionalId,
  rowVersion: z.string(),
})

const importRow = z.object({
  code: z.string().nullish(),
  positionTitle: z.string().nullish(),
  station: z.string().nullish(),
  employeeGroup: z.string().nullish(),
  division: z.string().nullish(),
  department: z.string().nullish(),
  subDepartment: z.string().nullish(),
  costCenter: z.string().nullish(),
  grade: z.string().nullish(),
  reportsTo: z.string().nullish(),
  minSalary: z.union([z.string(), z.number()]).nullish(),
  maxSalary: z.union([z.string(), z.number()]).nullish(),
})

/** Uploaded files the mock knows by id (the shared files mock keeps their bytes). */
function fileMeta(fileId: string) {
  return { id: fileId, name: `${fileId}.pdf`, mimeType: 'application/pdf', sizeBytes: null }
}

// --- plans: lines, budgets -------------------------------------------------------------------

type LineInput = z.infer<typeof lineBody>

/** Checks and prices the lines; a 422 for the first wrong one. */
function buildLines(input: LineInput[], duration: DurationRec): LineRec[] | Response {
  if (input.length === 0) {
    return invalid('lines', 'Add at least one new or existing position.')
  }
  const lines: LineRec[] = []
  for (const [index, line] of input.entries()) {
    const at = (field: string) => `lines[${String(index)}].${field}`
    const startDate = line.startDate ?? duration.startDate
    const endDate = line.endDate ?? duration.endDate
    if (endDate < startDate) return invalid(at('endDate'), 'The end cannot be before the start.')
    if (startDate < duration.startDate || startDate > duration.endDate) {
      return invalid(at('startDate'), 'The start must fall in the plan year.')
    }
    if (endDate > duration.endDate)
      return invalid(at('endDate'), 'The end must fall in the plan year.')
    if (line.kind === 'new_position') {
      const position = line.positionId ? positions.find(line.positionId) : undefined
      if (!position) return invalid(at('positionId'), 'Choose the position.')
      const band = bandOf(position.id)
      const headcount = line.headcount ?? 1
      if (headcount < 1) return invalid(at('headcount'), 'At least 1.')
      lines.push({
        id: createId('nl'),
        kind: 'new_position',
        positionId: position.id,
        employeeId: null,
        headcount,
        startDate,
        endDate,
        minSalary: line.minSalary ?? band?.minSalary ?? 0,
        maxSalary: line.maxSalary ?? band?.maxSalary ?? 0,
        monthlySalary: null,
        totalAllowance: line.totalAllowance ?? 0,
        eBudgetId: null,
      })
    } else {
      const person = findPerson(line.employeeId)
      if (!person) return invalid(at('employeeId'), 'Choose the employee.')
      lines.push({
        id: createId('xl'),
        kind: 'existing_employee',
        positionId: null,
        employeeId: person.id,
        headcount: 1,
        startDate,
        endDate,
        minSalary: null,
        maxSalary: null,
        monthlySalary: line.monthlySalary ?? person.salary,
        totalAllowance: line.totalAllowance ?? 0,
        eBudgetId: null,
      })
    }
  }
  return lines
}

/** Submitting makes one pending budget per position title and department of the lines. */
function makeBudgets(plan: PlanRec): PlanRec {
  const groups = new Map<
    string,
    { jobTitleId: string | null; departmentId: string | null; lines: LineRec[] }
  >()
  for (const line of plan.lines) {
    const position = line.positionId ? positions.find(line.positionId) : undefined
    const person = findPerson(line.employeeId)
    const jobTitleId = position?.jobTitleId ?? person?.jobTitleId ?? null
    const departmentId = position?.departmentId ?? person?.departmentId ?? null
    const key = `${jobTitleId ?? ''}|${departmentId ?? ''}`
    const group = groups.get(key) ?? { jobTitleId, departmentId, lines: [] }
    group.lines.push(line)
    groups.set(key, group)
  }
  const lines = [...plan.lines]
  for (const group of groups.values()) {
    const budgetId = createId('bg')
    budgets.insert({
      id: budgetId,
      title: orgName.jobTitle(group.jobTitleId) ?? 'Existing positions',
      budgetDurationId: plan.budgetDurationId,
      manpowerPlanId: plan.id,
      jobTitleId: group.jobTitleId,
      departmentId: group.departmentId,
      amount: group.lines.reduce((sum, line) => sum + priceOf(line).annualGross, 0),
      totalPositions: group.lines
        .filter((line) => line.kind === 'new_position')
        .reduce((sum, line) => sum + line.headcount, 0),
      startDate: group.lines.map((line) => line.startDate).sort()[0] ?? '',
      endDate:
        group.lines
          .map((line) => line.endDate)
          .sort()
          .at(-1) ?? '',
      status: 'pending',
      decidedByName: null,
      decidedAt: null,
      remarks: null,
      createdAt: now(),
      createdByName: ME,
      updatedAt: null,
      rowVersion: '0000000000000001',
    })
    for (const line of group.lines) {
      const index = lines.findIndex((item) => item.id === line.id)
      if (index >= 0) lines[index] = { ...line, eBudgetId: budgetId }
    }
  }
  return { ...plan, lines }
}

// --- handlers ----------------------------------------------------------------------------------

export const manpowerPlanningHandlers = [
  ...orgLookupHandlers,

  // E-Budget Settings: budget durations
  http.get(base('/budget-durations'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const q = textFilter(url)
    const isCurrent = url.searchParams.get('isCurrent')
    const rows = durations
      .all()
      .filter((rec) => !q || rec.name.toLowerCase().includes(q))
      .filter((rec) => isCurrent === null || String(rec.isCurrent) === isCurrent)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .map(toDuration)
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json(paginate(rows, page, pageSize))
  }),

  http.post(base('/budget-durations'), async ({ request }) => saveDuration(request, null)),
  http.put(base('/budget-durations/:id'), async ({ request, params }) =>
    saveDuration(request, String(params.id)),
  ),

  http.delete(base('/budget-durations/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const rec = durations.find(String(params.id))
    if (!rec) return notFound('Budget duration')
    if (versionOf(request) && versionOf(request) !== rec.rowVersion) return conflict()
    const used = toDuration(rec)
    if (used.planCount + used.budgetCount > 0) {
      return errorResponse(
        409,
        'This duration is the plan year of plans or budgets; it cannot be deleted.',
        {
          code: 'DURATION_IN_USE',
        },
      )
    }
    durations.remove(rec.id)
    return new HttpResponse(null, { status: 204 })
  }),

  // Position titles (Organisation's job titles, read only)
  http.get(base('/position-titles'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const q = textFilter(url)
    const rows: PositionTitle[] = JOB_TITLES.filter(
      (title) => !q || title.name.toLowerCase().includes(q),
    ).map((title) => {
      const mine = positions.all().filter((rec) => rec.jobTitleId === title.id)
      return {
        id: title.id,
        name: title.name,
        positionCount: mine.length,
        activePositionCount: mine.filter((rec) => rec.status === 'active').length,
        openPositionCount: openPositions
          .all()
          .filter((open) => open.jobTitleId === title.id && open.status === 'active').length,
        createdAt: title.createdAt,
        createdByName: ME,
        updatedAt: null,
      }
    })
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json(paginate(rows, page, pageSize))
  }),

  // Employee positions
  http.get(base('/positions'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const q = textFilter(url)
    const filter = (name: string) => url.searchParams.get(name)
    const rows = positions
      .all()
      .map(toPosition)
      .filter(
        (row) =>
          (!q ||
            row.code.toLowerCase().includes(q) ||
            row.jobTitleName.toLowerCase().includes(q)) &&
          (!filter('jobTitleId') || row.jobTitleId === filter('jobTitleId')) &&
          (!filter('branchId') || row.branchId === filter('branchId')) &&
          (!filter('divisionId') || row.divisionId === filter('divisionId')) &&
          (!filter('departmentId') || row.departmentId === filter('departmentId')) &&
          (!filter('employeeGroupId') || row.employeeGroupId === filter('employeeGroupId')) &&
          (!filter('status') || row.status === filter('status')),
      )
      .sort((a, b) => a.code.localeCompare(b.code))
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json(paginate(rows, page, pageSize))
  }),

  http.post(base('/positions/import'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const body = await readBody(request, z.object({ rows: z.array(importRow).min(1).max(2000) }))
    if (body instanceof Response) return body
    const errors: ImportError[] = []
    let created = 0
    const byName = (
      list: readonly { id: string; name: string }[],
      name: string | null | undefined,
    ) =>
      name ? list.find((item) => item.name.toLowerCase() === name.trim().toLowerCase()) : undefined
    for (const [index, row] of body.rows.entries()) {
      const rowNo = index + 1
      const fail = (field: string, message: string) => {
        errors.push({ rowNo, field, message })
      }
      const title = byName(JOB_TITLES, row.positionTitle)
      const station = byName(BRANCHES, row.station)
      const group = byName(EMPLOYEE_GROUPS, row.employeeGroup)
      const min = Number(row.minSalary ?? 0)
      const max = Number(row.maxSalary)
      const before = errors.length
      if (!title) fail('positionTitle', `Position title "${row.positionTitle ?? ''}" not found.`)
      if (!station) fail('station', `Station "${row.station ?? ''}" not found.`)
      if (!group) fail('employeeGroup', `Employee group "${row.employeeGroup ?? ''}" not found.`)
      if (!Number.isFinite(max) || max <= 0) fail('maxSalary', 'Enter the maximum salary.')
      else if (!Number.isFinite(min) || min > max) fail('minSalary', 'Check the minimum salary.')
      if (row.code && positions.all().some((rec) => rec.code === row.code)) {
        fail('code', `Position code ${row.code} is already used.`)
      }
      if (errors.length > before || !title || !station || !group) continue
      const reportsTo = row.reportsTo
        ? positions.all().find((rec) => rec.code === row.reportsTo)
        : undefined
      const positionId = createId('ep')
      positions.insert({
        id: positionId,
        code: row.code ?? `POS-${String(positions.all().length + 1).padStart(4, '0')}`,
        status: 'active',
        jobTitleId: title.id,
        branchId: station.id,
        employeeGroupId: group.id,
        divisionId: byName(DIVISIONS, row.division)?.id ?? null,
        departmentId: byName(DEPARTMENTS, row.department)?.id ?? null,
        subDepartmentId: byName(DEPARTMENTS, row.subDepartment)?.id ?? null,
        costCenterId: byName(COST_CENTERS, row.costCenter)?.id ?? null,
        gradeId: byName(GRADES, row.grade)?.id ?? null,
        reportsToId: reportsTo?.id ?? null,
        employeeId: null,
        createdAt: now(),
        createdByName: ME,
        updatedAt: null,
        updatedByName: null,
        rowVersion: '0000000000000001',
      })
      salaryRanges.insert({
        id: createId('sr'),
        positionId,
        effectiveDate: today(),
        minSalary: min,
        maxSalary: max,
        createdAt: now(),
        createdByName: ME,
        rowVersion: '0000000000000001',
      })
      created += 1
    }
    return HttpResponse.json({ data: { created, errors } })
  }),

  http.post(base('/positions'), async ({ request }) => savePosition(request, null)),
  http.put(base('/positions/:id'), async ({ request, params }) =>
    savePosition(request, String(params.id)),
  ),

  http.delete(base('/positions/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const rec = positions.find(String(params.id))
    if (!rec) return notFound('Position')
    if (versionOf(request) && versionOf(request) !== rec.rowVersion) return conflict()
    const used =
      plans.all().some((plan) => plan.lines.some((line) => line.positionId === rec.id)) ||
      openPositions.all().some((open) => open.positionId === rec.id)
    if (used) {
      return errorResponse(
        409,
        'This position is used by plans or open positions; it cannot be deleted.',
        {
          code: 'POSITION_IN_USE',
        },
      )
    }
    positions.remove(rec.id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(base('/positions/:id/salary-ranges'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const positionId = String(params.id)
    if (!positions.find(positionId)) return notFound('Position')
    return HttpResponse.json<ApiItem<SalaryRange[]>>({ data: rangesOf(positionId) })
  }),

  http.post(base('/positions/:id/salary-ranges'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const positionId = String(params.id)
    if (!positions.find(positionId)) return notFound('Position')
    const body = await readBody(
      request,
      z.object({
        effectiveDate: z.string().min(10),
        minSalary: money.min(0),
        maxSalary: money.positive(),
      }),
    )
    if (body instanceof Response) return body
    if (body.maxSalary < body.minSalary) {
      return invalid('maxSalary', 'Max salary cannot be below the min salary.')
    }
    const same = salaryRanges
      .all()
      .find(
        (range) => range.positionId === positionId && range.effectiveDate === body.effectiveDate,
      )
    if (same) salaryRanges.update(same.id, { ...same, ...body })
    else {
      salaryRanges.insert({
        id: createId('sr'),
        positionId,
        ...body,
        createdAt: now(),
        createdByName: ME,
        rowVersion: '0000000000000001',
      })
    }
    return HttpResponse.json<ApiItem<SalaryRange[]>>(
      { data: rangesOf(positionId) },
      { status: 201 },
    )
  }),

  // Planning
  http.get(base('/plans'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const q = textFilter(url)
    const filter = (name: string) => url.searchParams.get(name)
    const rows = plans
      .all()
      .map(toPlan)
      .filter(
        (row) =>
          (!q || row.title.toLowerCase().includes(q)) &&
          (!filter('budgetDurationId') || row.budgetDurationId === filter('budgetDurationId')) &&
          (!filter('status') || row.status === filter('status')) &&
          (filter('mode') !== 'new' || row.hasNewPositions) &&
          (filter('mode') !== 'existing' || row.hasExistingPositions) &&
          (filter('isCurrent') === null || String(row.isCurrent) === filter('isCurrent')),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json(paginate(rows, page, pageSize))
  }),

  http.get(base('/plans/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const rec = plans.find(String(params.id))
    if (!rec) return notFound('Plan')
    return HttpResponse.json<ApiItem<PlanDetail>>({ data: toPlanDetail(rec) })
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
    if (toPlan(rec).isLocked) {
      return errorResponse(409, 'This plan has approved budgets, so it cannot be deleted.', {
        code: 'PLAN_LOCKED',
        fieldErrors: { status: 'This plan has approved budgets, so it cannot be deleted.' },
      })
    }
    for (const budget of budgets.all().filter((item) => item.manpowerPlanId === rec.id)) {
      budgets.remove(budget.id)
    }
    plans.remove(rec.id)
    return new HttpResponse(null, { status: 204 })
  }),

  // E-Budgeting and Budget Approvals
  http.get(base('/budgets'), async ({ request }) => listBudgets(request, null)),
  http.get(base('/budget-approvals'), async ({ request }) => listBudgets(request, 'pending')),

  http.get(base('/budgets/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const rec = budgets.find(String(params.id))
    if (!rec) return notFound('Budget')
    return HttpResponse.json<ApiItem<Budget>>({ data: toBudget(rec) })
  }),

  http.post(base('/budgets'), async ({ request }) => saveBudget(request, null)),
  http.put(base('/budgets/:id'), async ({ request, params }) =>
    saveBudget(request, String(params.id)),
  ),

  http.delete(base('/budgets/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const rec = budgets.find(String(params.id))
    if (!rec) return notFound('Budget')
    if (versionOf(request) && versionOf(request) !== rec.rowVersion) return conflict()
    if (rec.status === 'approved') {
      return errorResponse(409, 'An approved budget cannot be deleted.', {
        code: 'BUDGET_LOCKED',
        fieldErrors: { status: 'An approved budget cannot be deleted.' },
      })
    }
    budgets.remove(rec.id)
    refreshPlanStatus(rec.manpowerPlanId)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(base('/budgets/:id/:decision'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const decision = String(params.decision)
    if (decision !== 'approve' && decision !== 'reject') return notFound('Route')
    const rec = budgets.find(String(params.id))
    if (!rec) return notFound('Budget')
    const body = await readBody(request, decisionBody)
    if (body instanceof Response) return body
    if (body.rowVersion !== rec.rowVersion) {
      return conflict('Someone else changed this budget. Reload it and try again')
    }
    if (rec.status !== 'pending') {
      return errorResponse(409, 'This budget was already decided.', {
        code: 'BUDGET_DECIDED',
        fieldErrors: { status: 'This budget was already decided.' },
      })
    }
    const decided: BudgetRec = {
      ...rec,
      status: decision === 'approve' ? 'approved' : 'rejected',
      decidedByName: ME,
      decidedAt: now(),
      remarks: body.remarks ?? null,
      updatedAt: now(),
      rowVersion: nextVersion(rec.rowVersion),
    }
    budgets.update(rec.id, decided)
    if (decision === 'approve') releaseOpenPositions(decided)
    refreshPlanStatus(rec.manpowerPlanId)
    return HttpResponse.json<ApiItem<Budget>>({ data: toBudget(decided) })
  }),

  // Open Positions
  http.get(base('/open-positions'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const q = textFilter(url)
    const status = url.searchParams.get('status')
    const rows = openPositions
      .all()
      .map(toOpen)
      .filter(
        (row) => (!q || row.title.toLowerCase().includes(q)) && (!status || row.status === status),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json(paginate(rows, page, pageSize))
  }),

  http.get(base('/open-positions/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const rec = openPositions.find(String(params.id))
    if (!rec) return notFound('Open position')
    return HttpResponse.json<ApiItem<OpenPosition>>({ data: toOpen(rec) })
  }),

  http.put(base('/open-positions/:id'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const rec = openPositions.find(String(params.id))
    if (!rec) return notFound('Open position')
    const body = await readBody(request, openBody)
    if (body instanceof Response) return body
    if (body.rowVersion !== rec.rowVersion) return conflict()
    const jdFile = body.jdFileId
      ? rec.jdFile?.id === body.jdFileId
        ? rec.jdFile
        : fileMeta(body.jdFileId)
      : null
    const next: OpenRec = {
      ...rec,
      totalPositions: body.totalPositions,
      endDate: body.endDate ?? null,
      jdFile,
      updatedAt: now(),
      rowVersion: nextVersion(rec.rowVersion),
    }
    openPositions.update(rec.id, next)
    return HttpResponse.json<ApiItem<OpenPosition>>({ data: toOpen(next) })
  }),

  http.post(base('/open-positions/:id/:action'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const action = String(params.action)
    if (action !== 'close' && action !== 'reopen') return notFound('Route')
    const rec = openPositions.find(String(params.id))
    if (!rec) return notFound('Open position')
    const body = await readBody(request, z.object({ rowVersion: z.string() }))
    if (body instanceof Response) return body
    if (body.rowVersion !== rec.rowVersion) return conflict()
    const next: OpenRec = {
      ...rec,
      status: action === 'close' ? 'closed' : 'active',
      updatedAt: now(),
      rowVersion: nextVersion(rec.rowVersion),
    }
    openPositions.update(rec.id, next)
    return HttpResponse.json<ApiItem<OpenPosition>>({ data: toOpen(next) })
  }),

  http.get(base('/open-positions/:id/jd'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const rec = openPositions.find(String(params.id))
    if (!rec) return notFound('Open position')
    if (!rec.jdFile) return notFound('Job description')
    return HttpResponse.json({
      data: { ...rec.jdFile, createdAt: rec.createdAt, url: mockFileUrl(rec.jdFile.id) },
    })
  }),
]

// --- handler bodies --------------------------------------------------------------------------

async function saveDuration(request: Request, durationId: string | null) {
  await latency()
  const denied = requireAuth(request)
  if (denied) return denied
  const current = durationId ? durations.find(durationId) : undefined
  if (durationId && !current) return notFound('Budget duration')
  const body = await readBody(request, durationBody)
  if (body instanceof Response) return body
  if (current && body.rowVersion !== current.rowVersion) return conflict()
  if (body.endDate < body.startDate) {
    return invalid('endDate', 'The end date cannot be before the start date.')
  }
  // Plan years do not overlap: a day belongs to one budget duration.
  const clash = durations
    .all()
    .find(
      (rec) =>
        rec.id !== durationId && rec.startDate <= body.endDate && body.startDate <= rec.endDate,
    )
  if (clash) {
    return invalid('startDate', `These dates overlap the ${clash.name} budget duration.`)
  }
  const name = body.name.trim()
  if (
    durations
      .all()
      .some((rec) => rec.id !== durationId && rec.name.toLowerCase() === name.toLowerCase())
  ) {
    return errorResponse(409, 'A budget duration with this name already exists.', {
      code: 'BUDGET_DURATION_DUPLICATE',
      fieldErrors: { name: 'A budget duration with this name already exists.' },
    })
  }
  if (body.isCurrent) {
    for (const rec of durations.all().filter((item) => item.isCurrent && item.id !== durationId)) {
      durations.update(rec.id, {
        ...rec,
        isCurrent: false,
        rowVersion: nextVersion(rec.rowVersion),
      })
    }
  }
  const saved: DurationRec = current
    ? {
        ...current,
        name,
        startDate: body.startDate,
        endDate: body.endDate,
        isCurrent: body.isCurrent,
        updatedAt: now(),
        rowVersion: nextVersion(current.rowVersion),
      }
    : {
        id: createId('bd'),
        name,
        startDate: body.startDate,
        endDate: body.endDate,
        isCurrent: body.isCurrent,
        createdAt: now(),
        createdByName: ME,
        updatedAt: null,
        rowVersion: '0000000000000001',
      }
  if (current) durations.update(saved.id, saved)
  else durations.insert(saved)
  return HttpResponse.json<ApiItem<BudgetDuration>>(
    { data: toDuration(saved) },
    { status: current ? 200 : 201 },
  )
}

function rangesOf(positionId: string): SalaryRange[] {
  return salaryRanges
    .all()
    .filter((range) => range.positionId === positionId)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
    .map((range) => ({ ...range, updatedAt: null }))
}

async function savePosition(request: Request, positionId: string | null) {
  await latency()
  const denied = requireAuth(request)
  if (denied) return denied
  const current = positionId ? positions.find(positionId) : undefined
  if (positionId && !current) return notFound('Position')
  const body = await readBody(request, positionBody)
  if (body instanceof Response) return body
  if (current && body.rowVersion !== current.rowVersion) return conflict()
  if (body.maxSalary < body.minSalary) {
    return invalid('maxSalary', 'Max salary cannot be below the min salary.')
  }
  if (positionId && body.reportsToId === positionId) {
    return invalid('reportsToId', 'A position cannot report to itself.')
  }
  const code =
    text(body.code) ?? current?.code ?? `POS-${String(positions.all().length + 1).padStart(4, '0')}`
  if (positions.all().some((rec) => rec.id !== positionId && rec.code === code)) {
    return errorResponse(409, 'A position with this code already exists.', {
      code: 'POSITION_DUPLICATE',
      fieldErrors: { code: 'A position with this code already exists.' },
    })
  }
  const saved: PositionRec = {
    id: current?.id ?? createId('ep'),
    code,
    status: body.status,
    jobTitleId: body.jobTitleId,
    branchId: body.branchId,
    employeeGroupId: body.employeeGroupId,
    divisionId: body.divisionId ?? null,
    departmentId: body.departmentId ?? null,
    subDepartmentId: body.subDepartmentId ?? null,
    costCenterId: body.costCenterId ?? null,
    gradeId: body.gradeId ?? null,
    reportsToId: body.reportsToId ?? null,
    employeeId: body.employeeId ?? null,
    createdAt: current?.createdAt ?? now(),
    createdByName: current?.createdByName ?? ME,
    updatedAt: current ? now() : null,
    updatedByName: current ? ME : null,
    rowVersion: current ? nextVersion(current.rowVersion) : '0000000000000001',
  }
  if (current) positions.update(saved.id, saved)
  else positions.insert(saved)
  // The band the form shows is today's: a change replaces today's range.
  const band = bandOf(saved.id)
  if (band?.minSalary !== body.minSalary || band.maxSalary !== body.maxSalary) {
    const todays = salaryRanges
      .all()
      .find((range) => range.positionId === saved.id && range.effectiveDate === today())
    if (todays)
      salaryRanges.update(todays.id, {
        ...todays,
        minSalary: body.minSalary,
        maxSalary: body.maxSalary,
      })
    else {
      salaryRanges.insert({
        id: createId('sr'),
        positionId: saved.id,
        effectiveDate: today(),
        minSalary: body.minSalary,
        maxSalary: body.maxSalary,
        createdAt: now(),
        createdByName: ME,
        rowVersion: '0000000000000001',
      })
    }
  }
  return HttpResponse.json<ApiItem<EmployeePosition>>(
    { data: toPosition(saved) },
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
  if (current && toPlan(current).isLocked) {
    return errorResponse(409, 'This plan has approved budgets, so it can no longer be changed.', {
      code: 'PLAN_LOCKED',
      fieldErrors: { status: 'This plan has approved budgets, so it can no longer be changed.' },
    })
  }
  const duration = durations.find(body.budgetDurationId)
  if (!duration) return invalid('budgetDurationId', 'Choose the plan year.')
  const title = body.title.trim()
  const lines = buildLines(body.lines, duration)
  if (lines instanceof Response) return lines
  // Editing replaces the plan's (all still unapproved) budgets and resubmits it.
  if (current) {
    for (const budget of budgets.all().filter((item) => item.manpowerPlanId === current.id)) {
      budgets.remove(budget.id)
    }
  }
  const files =
    body.fileIds === null || body.fileIds === undefined
      ? (current?.files ?? [])
      : body.fileIds.map(
          (fileId) => current?.files.find((file) => file.id === fileId) ?? fileMeta(fileId),
        )
  const saved = makeBudgets({
    id: current?.id ?? createId('pl'),
    title,
    budgetDurationId: duration.id,
    divisionId: body.divisionId ?? null,
    branchId: body.branchId ?? null,
    departmentId: body.departmentId ?? null,
    subDepartmentId: body.subDepartmentId ?? null,
    employeeGroupId: body.employeeGroupId ?? null,
    description: text(body.description),
    status: 'pending',
    submittedAt: now(),
    files,
    lines,
    createdAt: current?.createdAt ?? now(),
    createdByName: current?.createdByName ?? ME,
    updatedAt: current ? now() : null,
    updatedByName: current ? ME : null,
    rowVersion: current ? nextVersion(current.rowVersion) : '0000000000000001',
  })
  if (current) plans.update(saved.id, saved)
  else plans.insert(saved)
  return HttpResponse.json<ApiItem<PlanDetail>>(
    { data: toPlanDetail(saved) },
    { status: current ? 200 : 201 },
  )
}

async function listBudgets(request: Request, defaultStatus: string | null) {
  await latency()
  const denied = requireAuth(request)
  if (denied) return denied
  const url = new URL(request.url)
  const q = textFilter(url)
  const filter = (name: string) => url.searchParams.get(name)
  // Budget Approvals: no status = pending; an empty one = every status.
  const status = filter('status') ?? defaultStatus
  const rows = budgets
    .all()
    .map(toBudget)
    .filter(
      (row) =>
        (!q ||
          row.title.toLowerCase().includes(q) ||
          (row.planTitle ?? '').toLowerCase().includes(q)) &&
        (!status || row.status === status) &&
        (!filter('budgetDurationId') || row.budgetDurationId === filter('budgetDurationId')) &&
        (!filter('planId') || row.manpowerPlanId === filter('planId')) &&
        (!filter('departmentId') || row.departmentId === filter('departmentId')),
    )
    .sort(
      (a, b) =>
        Number(b.status === 'pending') - Number(a.status === 'pending') ||
        b.createdAt.localeCompare(a.createdAt),
    )
  const { page, pageSize } = readPageParams(url)
  return HttpResponse.json(paginate(rows, page, pageSize))
}

async function saveBudget(request: Request, budgetId: string | null) {
  await latency()
  const denied = requireAuth(request)
  if (denied) return denied
  const current = budgetId ? budgets.find(budgetId) : undefined
  if (budgetId && !current) return notFound('Budget')
  const body = await readBody(request, budgetBody)
  if (body instanceof Response) return body
  if (current && body.rowVersion !== current.rowVersion) return conflict()
  if (current?.status === 'approved') {
    return errorResponse(409, 'An approved budget cannot be changed.', {
      code: 'BUDGET_LOCKED',
      fieldErrors: { status: 'An approved budget cannot be changed.' },
    })
  }
  if (body.endDate < body.startDate) {
    return invalid('endDate', 'The end date cannot be before the start date.')
  }
  const title = text(body.title) ?? orgName.jobTitle(body.jobTitleId)
  if (!title) return invalid('title', 'Enter the title or choose the position title.')
  if (!durations.find(body.budgetDurationId)) {
    return invalid('budgetDurationId', 'Choose the budget duration.')
  }
  const saved: BudgetRec = {
    id: current?.id ?? createId('bg'),
    title,
    budgetDurationId: body.budgetDurationId,
    manpowerPlanId: current?.manpowerPlanId ?? null,
    jobTitleId: body.jobTitleId ?? null,
    departmentId: body.departmentId ?? null,
    amount: body.amount,
    totalPositions: body.totalPositions,
    startDate: body.startDate,
    endDate: body.endDate,
    // Editing a waiting or rejected budget sends it back to pending.
    status: 'pending',
    decidedByName: null,
    decidedAt: null,
    remarks: null,
    createdAt: current?.createdAt ?? now(),
    createdByName: current?.createdByName ?? ME,
    updatedAt: current ? now() : null,
    rowVersion: current ? nextVersion(current.rowVersion) : '0000000000000001',
  }
  if (current) budgets.update(saved.id, saved)
  else budgets.insert(saved)
  refreshPlanStatus(saved.manpowerPlanId)
  return HttpResponse.json<ApiItem<Budget>>(
    { data: toBudget(saved) },
    { status: current ? 200 : 201 },
  )
}

/** One open position per new-position line of the budget, or one for its total positions. */
function releaseOpenPositions(budget: BudgetRec) {
  const plan = budget.manpowerPlanId ? plans.find(budget.manpowerPlanId) : undefined
  const lines = (plan?.lines ?? []).filter(
    (line) => line.eBudgetId === budget.id && line.kind === 'new_position',
  )
  const base = {
    eBudgetId: budget.id,
    status: 'active' as const,
    jdFile: null,
    approvedAt: now(),
    approvedByName: ME,
    createdAt: now(),
    updatedAt: null,
    rowVersion: '0000000000000001',
  }
  if (lines.length === 0) {
    if (budget.totalPositions === 0) return
    openPositions.insert({
      ...base,
      id: createId('op'),
      title: budget.title,
      manpowerPlanLineId: null,
      positionId: null,
      jobTitleId: budget.jobTitleId,
      departmentId: budget.departmentId,
      branchId: null,
      approvedPositions: budget.totalPositions,
      totalPositions: budget.totalPositions,
      endDate: budget.endDate,
    })
    return
  }
  for (const line of lines) {
    const position = line.positionId ? positions.find(line.positionId) : undefined
    openPositions.insert({
      ...base,
      id: createId('op'),
      title: orgName.jobTitle(position?.jobTitleId) ?? budget.title,
      manpowerPlanLineId: line.id,
      positionId: line.positionId,
      jobTitleId: position?.jobTitleId ?? budget.jobTitleId,
      departmentId: position?.departmentId ?? budget.departmentId,
      branchId: position?.branchId ?? null,
      approvedPositions: line.headcount,
      totalPositions: line.headcount,
      endDate: line.endDate,
    })
  }
}

export function resetManpowerPlanningDb(): void {
  resetManpowerCollections()
}
