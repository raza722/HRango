import { format } from 'date-fns'
import { http, type HttpHandler } from 'msw'
import { z } from 'zod'

import {
  type BenefitFileRow,
  type BenefitPlan,
  type BenefitsLookups,
  type BenefitsSummary,
  CARRIERS,
  CATEGORY_VALUES,
  categoryMeta,
  type Election,
  ELECTION_UNITS,
  type EmployeeRow,
  type EnrollmentWindow,
  type EnrollmentWindowRow,
  MARITAL_STATUSES,
  NEW_HIRE_VALUES,
  type PlanRow,
  type PlanYear,
  type PlanYearRow,
  type PlanYearStatus,
  PROFILE_FIELDS,
} from '@/features/benefits'

import { DIRECTORY, findEmployee } from '../employees/seed'
import { conflict, day, invalid, notFound, ok, param, readBody, rejected } from '../payroll/http'
import { apiPath, createId, latency, requireAuth } from '../utils'
import { elections, enrollmentWindows, plans, planYears, profiles } from './db'

export { resetBenefitsDb } from './db'

const base = (path: string) => apiPath(`/benefits${path}`)

const authed = async (request: Request) => {
  await latency()
  return requireAuth(request)
}

const today = () => format(new Date(), 'yyyy-MM-dd')
const now = () => new Date().toISOString()
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

// --- derived values -----------------------------------------------------------------------------

function planYearStatus(year: PlanYear): PlanYearStatus {
  const date = today()
  if (date < year.startDate) return 'upcoming'
  if (date > year.endDate) return 'ended'
  return 'active'
}

/** People whose benefit details are not complete. */
function missingOf(employeeId: string): string[] {
  const profile = profiles.find(employeeId)
  return PROFILE_FIELDS.filter((field) => !profile?.[field.key]).map((field) => field.label)
}

const missingCount = () => DIRECTORY.filter((person) => missingOf(person.id).length > 0).length

function planYearRow(year: PlanYear): PlanYearRow {
  const mine = elections.all().filter((election) => election.planYearId === year.id)
  const count = (status: Election['status']) =>
    mine.filter((election) => election.status === status).length
  return {
    ...year,
    status: planYearStatus(year),
    pending: count('pending'),
    approved: count('approved'),
    incomplete: count('incomplete'),
    missingInformation: missingCount(),
  }
}

/** The plan years a `?year=` filter keeps (all of them without one). */
function yearsInScope(url: URL): PlanYear[] {
  const id = param(url, 'year')
  return planYears.all().filter((year) => !id || year.id === id)
}

function planRow(plan: BenefitPlan, scope: PlanYear[]): PlanRow {
  const ids = new Set(scope.map((year) => year.id))
  const enrolled = new Set(
    elections
      .all()
      .filter(
        (election) =>
          ids.has(election.planYearId) &&
          election.status === 'approved' &&
          election.planIds.includes(plan.id),
      )
      .map((election) => election.employeeId),
  ).size
  return { ...plan, enrolled, notEnrolled: Math.max(0, DIRECTORY.length - enrolled) }
}

function windowRow(window: EnrollmentWindow): EnrollmentWindowRow {
  return {
    ...window,
    planYearName: planYears.find(window.planYearId)?.name ?? '—',
    status: today() > window.enrollmentEndDate ? 'closed' : 'open',
  }
}

const byStart = (a: PlanYear, b: PlanYear) => b.startDate.localeCompare(a.startDate)
const byCreated = (a: { createdAt: string }, b: { createdAt: string }) =>
  b.createdAt.localeCompare(a.createdAt)

// --- validation ---------------------------------------------------------------------------------

const knownPlans = (ids: string[]) => ids.every((id) => Boolean(plans.find(id)))

const planYearInput = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter the plan year name')
      .max(60, 'Keep it under 60 characters'),
    startDate: day,
    endDate: day,
    planIds: z.array(z.string()).min(1, 'Choose at least one plan'),
    newHireStart: z.enum(NEW_HIRE_VALUES),
    electionPeriod: z
      .number({ error: 'Enter how long' })
      .int('Enter a whole number')
      .min(1, 'Enter at least 1')
      .max(365, 'Enter 365 or less'),
    electionUnit: z.enum(ELECTION_UNITS as ['day', 'week', 'month']),
  })
  .refine((value) => value.endDate > value.startDate, {
    message: 'The plan year must end after it starts',
    path: ['endDate'],
  })

const planInput = z
  .object({
    category: z.enum(CATEGORY_VALUES),
    name: z.string().trim().min(1, 'Enter the plan name').max(60, 'Keep it under 60 characters'),
    planType: z.string().min(1, 'Choose the plan type'),
    planTypeId: z
      .string()
      .trim()
      .min(1, 'Enter the plan type ID')
      .max(30, 'Keep it under 30 characters'),
    carrier: z.string().refine((value) => (CARRIERS as readonly string[]).includes(value), {
      message: 'Choose the carrier',
    }),
    startDate: day,
    endDate: day,
    attachmentName: z.string().trim().min(1, 'Choose a file'),
    attachmentSize: z.number().min(0),
  })
  .refine((value) => value.endDate > value.startDate, {
    message: 'The plan must end after it starts',
    path: ['endDate'],
  })
  .refine((value) => categoryMeta(value.category).planTypes.includes(value.planType), {
    message: 'Choose the plan type',
    path: ['planType'],
  })

const windowInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter the enrollment name')
    .max(80, 'Keep it under 80 characters'),
  planYearId: z.string().min(1, 'Choose the plan year'),
  effectiveDate: day,
  enrollmentEndDate: day,
  planIds: z.array(z.string()).min(1, 'Choose at least one plan'),
  employeeIds: z.array(z.string()).min(1, 'Choose who can enroll'),
})

const profileInput = z.object({
  dateOfBirth: day,
  maritalStatus: z
    .string()
    .refine((value) => (MARITAL_STATUSES as readonly string[]).includes(value), {
      message: 'Choose the marital status',
    }),
  homeAddress: z
    .string()
    .trim()
    .min(1, 'Enter the home address')
    .max(200, 'Keep it under 200 characters'),
})

function checkPlanYear(input: z.infer<typeof planYearInput>, id?: string) {
  if (planYears.all().some((year) => year.id !== id && sameName(year.name, input.name))) {
    return conflict('A plan year with this name already exists.', 'DUPLICATE', {
      name: 'A plan year with this name already exists',
    })
  }
  if (!knownPlans(input.planIds)) return invalid('Choose plans from the list.')
  return null
}

// --- handlers -----------------------------------------------------------------------------------

export const benefitsHandlers: HttpHandler[] = [
  http.get(base('/summary'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    return ok<BenefitsSummary>({
      employees: DIRECTORY.length,
      planYears: planYears.all().length,
      plans: plans.all().length,
      enrollmentWindows: enrollmentWindows.all().length,
    })
  }),

  http.get(base('/lookups'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    return ok<BenefitsLookups>({
      planYears: planYears
        .all()
        .sort(byStart)
        .map(({ id, name, startDate, endDate, planIds }) => ({
          id,
          name,
          startDate,
          endDate,
          planIds,
        })),
      plans: plans.all().map(({ id, name, category }) => ({ id, name, category })),
      employees: DIRECTORY.map(({ id, name, jobTitle, department }) => ({
        id,
        name,
        jobTitle,
        department,
      })),
      departments: [...new Set(DIRECTORY.map((person) => person.department))].sort(),
      carriers: [...CARRIERS],
    })
  }),

  // Plan Years
  http.get(base('/plan-years'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    return ok(yearsInScope(new URL(request.url)).sort(byStart).map(planYearRow))
  }),

  http.get(base('/plan-years/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const year = planYears.find(String(params.id))
    return year ? ok(planYearRow(year)) : notFound('plan year')
  }),

  http.post(base('/plan-years'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const parsed = await readBody(request, planYearInput)
    if (!parsed.success) return rejected(parsed.error)
    const refused = checkPlanYear(parsed.data)
    if (refused) return refused
    const year = planYears.insert({ id: createId('by'), ...parsed.data, createdAt: now() })
    return ok(planYearRow(year))
  }),

  http.put(base('/plan-years/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const year = planYears.find(String(params.id))
    if (!year) return notFound('plan year')
    const parsed = await readBody(request, planYearInput)
    if (!parsed.success) return rejected(parsed.error)
    const refused = checkPlanYear(parsed.data, year.id)
    if (refused) return refused
    const next = planYears.update(year.id, { ...year, ...parsed.data }) ?? year
    // Windows keep only the plans the year still offers.
    for (const window of enrollmentWindows.all().filter((item) => item.planYearId === year.id)) {
      enrollmentWindows.update(window.id, {
        ...window,
        planIds: window.planIds.filter((id) => next.planIds.includes(id)),
      })
    }
    return ok(planYearRow(next))
  }),

  http.delete(base('/plan-years/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const year = planYears.find(String(params.id))
    if (!year) return notFound('plan year')
    planYears.remove(year.id)
    for (const window of enrollmentWindows.all()) {
      if (window.planYearId === year.id) enrollmentWindows.remove(window.id)
    }
    for (const election of elections.all()) {
      if (election.planYearId === year.id) elections.remove(election.id)
    }
    return ok({ id: year.id })
  }),

  // Plans
  http.get(base('/plans'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const url = new URL(request.url)
    const scope = yearsInScope(url)
    const offered = new Set(scope.flatMap((year) => year.planIds))
    const rows = plans
      .all()
      .filter((plan) => !param(url, 'year') || offered.has(plan.id))
      // By category (the menu's order), then oldest first; the seed keeps its own order.
      .sort(
        (a, b) =>
          CATEGORY_VALUES.indexOf(a.category) - CATEGORY_VALUES.indexOf(b.category) ||
          a.createdAt.localeCompare(b.createdAt),
      )
      .map((plan) => planRow(plan, scope))
    return ok(rows)
  }),

  http.post(base('/plans'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const parsed = await readBody(request, planInput)
    if (!parsed.success) return rejected(parsed.error)
    const input = parsed.data
    if (
      plans
        .all()
        .some((plan) => plan.category === input.category && sameName(plan.name, input.name))
    ) {
      const message = `A ${categoryMeta(input.category).label} plan with this name already exists`
      return conflict(`${message}.`, 'DUPLICATE', { name: message })
    }
    const plan = plans.insert({
      id: createId('bp'),
      ...input,
      eligibility: 'Full-Time',
      createdAt: now(),
    })
    return ok(planRow(plan, planYears.all()))
  }),

  http.post(base('/plans/:id/duplicate'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const plan = plans.find(String(params.id))
    if (!plan) return notFound('plan')
    const taken = (name: string) =>
      plans.all().some((item) => item.category === plan.category && sameName(item.name, name))
    let name = `${plan.name} (copy)`
    for (let index = 2; taken(name); index += 1) name = `${plan.name} (copy ${String(index)})`
    const copy = plans.insert({ ...plan, id: createId('bp'), name, createdAt: now() })
    return ok(planRow(copy, planYears.all()))
  }),

  http.delete(base('/plans/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const plan = plans.find(String(params.id))
    if (!plan) return notFound('plan')
    const enrolled = planRow(plan, planYears.all()).enrolled
    if (enrolled > 0) {
      return conflict(
        `${plan.name} has ${String(enrolled)} enrolled ${enrolled === 1 ? 'employee' : 'employees'}, so it cannot be deleted.`,
        'IN_USE',
      )
    }
    plans.remove(plan.id)
    for (const year of planYears.all()) {
      if (year.planIds.includes(plan.id)) {
        planYears.update(year.id, { ...year, planIds: year.planIds.filter((id) => id !== plan.id) })
      }
    }
    for (const window of enrollmentWindows.all()) {
      if (window.planIds.includes(plan.id)) {
        enrollmentWindows.update(window.id, {
          ...window,
          planIds: window.planIds.filter((id) => id !== plan.id),
        })
      }
    }
    for (const election of elections.all()) {
      if (election.planIds.includes(plan.id)) {
        elections.update(election.id, {
          ...election,
          planIds: election.planIds.filter((id) => id !== plan.id),
        })
      }
    }
    return ok({ id: plan.id })
  }),

  // Enrollment Windows
  http.get(base('/enrollment-windows'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const ids = new Set(yearsInScope(new URL(request.url)).map((year) => year.id))
    return ok(
      enrollmentWindows
        .all()
        .filter((window) => ids.has(window.planYearId))
        .sort(byCreated)
        .map(windowRow),
    )
  }),

  http.post(base('/enrollment-windows'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const parsed = await readBody(request, windowInput)
    if (!parsed.success) return rejected(parsed.error)
    const input = parsed.data
    const year = planYears.find(input.planYearId)
    if (!year) return invalid('Choose the plan year.', { planYearId: 'Choose the plan year' })
    if (input.effectiveDate < year.startDate || input.effectiveDate > year.endDate) {
      const message = 'Choose a date within the plan year'
      return invalid(`${message}.`, { effectiveDate: message })
    }
    if (!input.planIds.every((id) => year.planIds.includes(id))) {
      return invalid('Choose plans the plan year offers.', {
        planIds: 'Choose plans the plan year offers',
      })
    }
    if (!input.employeeIds.every((id) => Boolean(findEmployee(id)))) {
      return invalid('Choose people from the list.', { employeeIds: 'Choose people from the list' })
    }
    const window = enrollmentWindows.insert({ id: createId('ew'), ...input, createdAt: now() })
    return ok(windowRow(window))
  }),

  http.delete(base('/enrollment-windows/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const window = enrollmentWindows.find(String(params.id))
    if (!window) return notFound('enrollment window')
    enrollmentWindows.remove(window.id)
    return ok({ id: window.id })
  }),

  // Employees
  http.get(base('/employees'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const url = new URL(request.url)
    const scope = yearsInScope(url).sort(byStart)
    const onlyMissing = param(url, 'missing') === 'true'
    const rows: EmployeeRow[] = DIRECTORY.map((person) => {
      const profile = profiles.find(person.id) ?? {
        id: person.id,
        dateOfBirth: null,
        maritalStatus: null,
        homeAddress: null,
      }
      return {
        id: person.id,
        name: person.name,
        jobTitle: person.jobTitle,
        department: person.department,
        elections: scope.map((year) => ({
          planYearId: year.id,
          planYearName: year.name,
          status:
            elections
              .all()
              .find(
                (election) => election.planYearId === year.id && election.employeeId === person.id,
              )?.status ?? null,
        })),
        missing: missingOf(person.id),
        profile,
      }
    }).filter((row) => !onlyMissing || row.missing.length > 0)
    return ok(rows)
  }),

  http.put(base('/employees/:id/profile'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const person = findEmployee(String(params.id))
    if (!person) return notFound('employee')
    const parsed = await readBody(request, profileInput)
    if (!parsed.success) return rejected(parsed.error)
    if (parsed.data.dateOfBirth >= today()) {
      return invalid('Choose a date of birth in the past.', {
        dateOfBirth: 'Choose a date in the past',
      })
    }
    const profile = { id: person.id, ...parsed.data }
    if (profiles.find(person.id)) profiles.update(person.id, profile)
    else profiles.insert(profile)
    return ok(profile)
  }),

  // Files: the plans' attachments.
  http.get(base('/files'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const url = new URL(request.url)
    const offered = new Set(yearsInScope(url).flatMap((year) => year.planIds))
    const rows: BenefitFileRow[] = plans
      .all()
      .filter((plan) => !param(url, 'year') || offered.has(plan.id))
      .sort(byCreated)
      .map((plan) => ({
        id: plan.id,
        fileName: plan.attachmentName,
        size: plan.attachmentSize,
        planId: plan.id,
        planName: plan.name,
        category: plan.category,
        addedOn: plan.createdAt.slice(0, 10),
      }))
    return ok(rows)
  }),
]
