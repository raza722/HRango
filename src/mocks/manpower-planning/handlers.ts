import { format, lastDayOfMonth, parse } from 'date-fns'
import { http, type HttpHandler } from 'msw'
import { z } from 'zod'

import {
  type Budget,
  type BudgetDuration,
  type BudgetRow,
  type EmployeePosition,
  type EmployeePositionRow,
  existingLineAnnual,
  type JobDescription,
  type ManpowerLookups,
  newLineAnnual,
  type OpenPosition,
  type Plan,
  planAnnual,
  type PlanDetail,
  planMonthly,
  type PlanRow,
  type PlanStatus,
  type Stamp,
} from '@/features/manpower-planning'

import { DIRECTORY, findEmployee } from '../employees/seed'
import { isActive, salaryOn } from '../payroll/engine'
import {
  conflict,
  day,
  invalid,
  ME,
  notFound,
  ok,
  page,
  param,
  readBody,
  rejected,
} from '../payroll/http'
import { branches } from '../settings/handlers'
import { apiPath, createId, latency, requireAuth } from '../utils'
import {
  budgets,
  durations,
  openPositions,
  plans,
  positions,
  positionTitles,
  resetManpowerCollections,
} from './db'
import {
  COST_CENTERS,
  DEPARTMENTS,
  DIVISIONS,
  EMPLOYEE_GROUPS,
  GRADES,
  SUB_DEPARTMENTS,
} from './seed'

const base = (path: string) => apiPath(`/manpower-planning${path}`)

const authed = async (request: Request) => {
  await latency()
  return requireAuth(request)
}

const today = () => format(new Date(), 'yyyy-MM-dd')

/** The signed-in person, as "by Shelley Kannes, HR Manager". */
function stampNow(): Stamp {
  const me = findEmployee(ME)
  return {
    at: new Date().toISOString(),
    byName: me?.name ?? 'Shelley Kannes',
    byRole: me?.jobTitle ?? 'HR Manager',
  }
}

const contains = (value: string, wanted: string | undefined) =>
  !wanted || value.toLowerCase().includes(wanted.trim().toLowerCase())
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
const plural = (count: number, word: string) => `${String(count)} ${word}${count === 1 ? '' : 's'}`
const monthEnd = (month: string) =>
  format(lastDayOfMonth(parse(`${month}-01`, 'yyyy-MM-dd', new Date())), 'yyyy-MM-dd')
const formatDay = (value: string) => format(parse(value, 'yyyy-MM-dd', new Date()), 'd MMM yyyy')

// --- lookups ------------------------------------------------------------------------------------

const stationOptions = () =>
  branches
    .all()
    .map((branch) => ({ id: branch.id, name: branch.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

const departmentIdOf = (name: string) => DEPARTMENTS.find((item) => item.name === name)?.id ?? null
const nameIn = (list: readonly { id: string; name: string }[], id: string | null) =>
  id ? (list.find((item) => item.id === id)?.name ?? '') : ''
const stationName = (id: string | null) => nameIn(stationOptions(), id)

const titleOf = (positionTitleId: string) => positionTitles.find(positionTitleId)?.title ?? '—'
const positionTitleOf = (positionId: string) => {
  const position = positions.find(positionId)
  return position ? titleOf(position.positionTitleId) : '—'
}
const durationName = (id: string) => durations.find(id)?.name ?? '—'

function lookups(): ManpowerLookups {
  return {
    divisions: DIVISIONS,
    stations: stationOptions(),
    departments: DEPARTMENTS,
    subDepartments: SUB_DEPARTMENTS,
    employeeGroups: EMPLOYEE_GROUPS,
    grades: GRADES,
    costCenters: COST_CENTERS,
    employees: DIRECTORY.filter((employee) => isActive(employee.id)).map((employee) => ({
      id: employee.id,
      name: employee.name,
      jobTitle: employee.jobTitle,
      departmentId: departmentIdOf(employee.department),
      stationId: employee.branchId,
      salary: salaryOn(employee.id, today()),
    })),
    durations: durations.all().sort((a, b) => b.startDate.localeCompare(a.startDate)),
    positionTitles: positionTitles
      .all()
      .map((title) => ({ id: title.id, title: title.title, active: title.active }))
      .sort((a, b) => a.title.localeCompare(b.title)),
    positions: positions
      .all()
      .map((position) => ({
        id: position.id,
        code: position.code,
        title: titleOf(position.positionTitleId),
        positionTitleId: position.positionTitleId,
        divisionId: position.divisionId,
        stationId: position.stationId,
        departmentId: position.departmentId,
        subDepartmentId: position.subDepartmentId,
        employeeGroupId: position.employeeGroupId,
        minSalary: position.minSalary,
        maxSalary: position.maxSalary,
        active: position.active,
      }))
      .sort((a, b) => a.title.localeCompare(b.title) || a.code.localeCompare(b.code)),
  }
}

// --- plans, budgets and their links -------------------------------------------------------------

const budgetsOf = (planId: string) => budgets.all().filter((budget) => budget.planId === planId)
/** A plan with an approved budget can no longer change. */
const isLocked = (planId: string) => budgetsOf(planId).some((budget) => budget.status === 'active')

function statusFromBudgets(planId: string): PlanStatus {
  const list = budgetsOf(planId)
  if (list.length > 0 && list.every((budget) => budget.status === 'active')) return 'approved'
  if (list.some((budget) => budget.status === 'rejected')) return 'rejected'
  return 'pending'
}

/** A plan's status follows its budgets: all approved, any rejected, or waiting. */
function syncPlanStatus(planId: string | null) {
  const plan = planId ? plans.find(planId) : undefined
  if (!plan) return
  const status = statusFromBudgets(plan.id)
  if (status !== plan.status) plans.update(plan.id, { ...plan, status })
}

const budgetRow = (budget: Budget): BudgetRow => ({
  ...budget,
  duration: durationName(budget.durationId),
  planTitle: budget.planId ? (plans.find(budget.planId)?.title ?? null) : null,
})

function planRow(plan: Plan): PlanRow {
  return {
    id: plan.id,
    title: plan.title,
    monthlyAmount: planMonthly(plan),
    annualAmount: planAnnual(plan),
    durationId: plan.durationId,
    planningYear: durationName(plan.durationId),
    isCurrent: durations.find(plan.durationId)?.isCurrent ?? false,
    status: plan.status,
    modes: [
      ...(plan.newPositions.length > 0 ? (['new'] as const) : []),
      ...(plan.existingPositions.length > 0 ? (['existing'] as const) : []),
    ],
    added: plan.added,
    locked: isLocked(plan.id),
  }
}

const planDetail = (plan: Plan): PlanDetail => ({
  ...plan,
  planningYear: durationName(plan.durationId),
  monthlyAmount: planMonthly(plan),
  annualAmount: planAnnual(plan),
  locked: isLocked(plan.id),
  budgets: budgetsOf(plan.id).map(budgetRow),
})

/**
 * The budgets a plan asks for: one per position, adding up its new positions (each one
 * a vacancy) and the existing people in that job, from the first month to the last.
 */
function budgetsFor(plan: Plan, added: Stamp): Budget[] {
  const groups = new Map<
    string,
    { title: string; amount: number; positions: number; start: string; end: string }
  >()
  const add = (title: string, amount: number, opens: number, start: string, end: string) => {
    const key = title.toLowerCase()
    const group = groups.get(key)
    if (!group) {
      groups.set(key, { title, amount, positions: opens, start, end })
      return
    }
    group.amount += amount
    group.positions += opens
    if (start < group.start) group.start = start
    if (end > group.end) group.end = end
  }
  for (const line of plan.newPositions) {
    add(
      positionTitleOf(line.positionId),
      newLineAnnual(line),
      1,
      `${line.fromMonth}-01`,
      monthEnd(line.toMonth),
    )
  }
  for (const line of plan.existingPositions) {
    const title = findEmployee(line.employeeId)?.jobTitle ?? 'Existing position'
    add(title, existingLineAnnual(line), 0, line.startDate, line.endDate)
  }
  return [...groups.values()].map((group) => ({
    id: createId('bg'),
    planId: plan.id,
    title: group.title,
    durationId: plan.durationId,
    amount: Math.round(group.amount),
    startDate: group.start,
    endDate: group.end,
    positions: group.positions,
    status: 'pending' as const,
    added,
    decided: null,
  }))
}

const nullableId = z.string().nullable()
const month = z.string().regex(/^\d{4}-\d{2}$/, 'Choose a month')
const amount = (message: string) =>
  z.number({ error: message }).min(0, 'The amount cannot be negative').max(1e10)

const newLineSchema = z.object({
  id: z.string().min(1),
  positionId: z.string().min(1, 'Choose the position'),
  fromMonth: month,
  toMonth: month,
  divisionId: nullableId,
  stationId: nullableId,
  departmentId: nullableId,
  subDepartmentId: nullableId,
  employeeGroupId: nullableId,
  minSalary: amount('Enter the min salary').positive('Enter the min salary'),
  maxSalary: amount('Enter the max salary').positive('Enter the max salary'),
  totalAllowance: amount('Enter the allowance'),
})

const existingLineSchema = z.object({
  id: z.string().min(1),
  employeeId: z.string().min(1, 'Choose the employee'),
  startDate: day,
  endDate: day,
  monthlySalary: amount('Enter the monthly salary').positive('Enter the monthly salary'),
  totalAllowance: amount('Enter the allowance'),
})

const planSchema = z.object({
  title: z.string().trim().min(1, 'Enter the title').max(80, 'Keep it under 80 characters'),
  durationId: z.string().min(1, 'Choose the plan year'),
  divisionId: nullableId,
  stationId: nullableId,
  departmentId: nullableId,
  subDepartmentId: nullableId,
  employeeGroupId: nullableId,
  description: z.string().trim().max(1000, 'Keep it under 1000 characters'),
  newPositions: z.array(newLineSchema).max(200),
  existingPositions: z.array(existingLineSchema).max(200),
})
type PlanBody = z.infer<typeof planSchema>

/** The rules that need the stored data; a 422 / 409 naming the field, or null. */
function checkPlan(body: PlanBody, planId: string | null): Response | null {
  const duration = durations.find(body.durationId)
  if (!duration) return invalid('Choose the plan year', { durationId: 'Choose the plan year' })
  if (body.newPositions.length + body.existingPositions.length === 0) {
    return invalid('Add at least one new or existing position')
  }
  const clash = plans
    .all()
    .some(
      (plan) =>
        plan.id !== planId && plan.durationId === duration.id && same(plan.title, body.title),
    )
  if (clash) {
    const message = `A plan with this title already exists for ${duration.name}`
    return conflict(message, 'DUPLICATE', { title: message })
  }
  const firstMonth = duration.startDate.slice(0, 7)
  const lastMonth = duration.endDate.slice(0, 7)
  for (const [index, line] of body.newPositions.entries()) {
    const at = (field: string) => `newPositions.${String(index)}.${field}`
    const position = positions.find(line.positionId)
    if (!position)
      return invalid('Choose the position', { [at('positionId')]: 'Choose the position' })
    if (line.toMonth < line.fromMonth) {
      const message = 'The end month cannot be before the start month'
      return invalid(message, { [at('toMonth')]: message })
    }
    if (line.fromMonth < firstMonth || line.toMonth > lastMonth) {
      const message = `Plan the position within ${duration.name}`
      return invalid(message, {
        [at(line.fromMonth < firstMonth ? 'fromMonth' : 'toMonth')]: message,
      })
    }
    if (line.maxSalary < line.minSalary) {
      const message = 'The max salary cannot be below the min salary'
      return invalid(message, { [at('maxSalary')]: message })
    }
  }
  const seen = new Set<string>()
  for (const [index, line] of body.existingPositions.entries()) {
    const at = (field: string) => `existingPositions.${String(index)}.${field}`
    if (!findEmployee(line.employeeId)) {
      return invalid('Choose the employee', { [at('employeeId')]: 'Choose the employee' })
    }
    if (seen.has(line.employeeId)) {
      const message = 'This employee is already in the plan'
      return invalid(message, { [at('employeeId')]: message })
    }
    seen.add(line.employeeId)
    if (line.endDate < line.startDate) {
      const message = 'The end date cannot be before the start date'
      return invalid(message, { [at('endDate')]: message })
    }
    if (line.startDate < duration.startDate || line.endDate > duration.endDate) {
      const message = `Keep the dates within ${duration.name}`
      return invalid(message, {
        [at(line.startDate < duration.startDate ? 'startDate' : 'endDate')]: message,
      })
    }
  }
  return null
}

const planHandlers = [
  http.get(base('/plans'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const mode = param(url, 'mode')
    const status = param(url, 'status')
    const durationId = param(url, 'durationId')
    const year = param(url, 'year')
    const list = plans
      .all()
      .map(planRow)
      .filter(
        (row) =>
          contains(row.title, param(url, 'title')) &&
          (!durationId || row.durationId === durationId) &&
          contains(row.planningYear, year) &&
          (!status || row.status === status) &&
          (!mode || row.modes.some((item) => item === mode)),
      )
      .sort((a, b) => b.added.at.localeCompare(a.added.at))
    return page(url, list)
  }),
  http.get(base('/plans/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const plan = plans.find(String(params.id))
    return plan ? ok(planDetail(plan)) : notFound('plan')
  }),
  http.post(base('/plans'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, planSchema)
    if (!parsed.success) return rejected(parsed.error)
    const problem = checkPlan(parsed.data, null)
    if (problem) return problem
    const stamp = stampNow()
    const plan: Plan = {
      ...parsed.data,
      id: createId('pl'),
      status: 'pending',
      added: stamp,
      modified: stamp,
    }
    plans.insert(plan)
    for (const budget of budgetsFor(plan, stamp)) budgets.insert(budget)
    return ok(planDetail(plan))
  }),
  http.put(base('/plans/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const existing = plans.find(String(params.id))
    if (!existing) return notFound('plan')
    if (isLocked(existing.id)) {
      return conflict('This plan has approved budgets, so it can no longer be changed.', 'LOCKED')
    }
    const parsed = await readBody(request, planSchema)
    if (!parsed.success) return rejected(parsed.error)
    const problem = checkPlan(parsed.data, existing.id)
    if (problem) return problem
    const stamp = stampNow()
    const plan: Plan = { ...existing, ...parsed.data, status: 'pending', modified: stamp }
    plans.update(plan.id, plan)
    // Edited plans go back for approval with fresh budgets.
    for (const budget of budgetsOf(plan.id)) budgets.remove(budget.id)
    for (const budget of budgetsFor(plan, stamp)) budgets.insert(budget)
    return ok(planDetail(plan))
  }),
  http.delete(base('/plans/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const plan = plans.find(String(params.id))
    if (!plan) return notFound('plan')
    // Budgets still waiting are withdrawn; approved ones stay, with their open positions.
    for (const budget of budgetsOf(plan.id)) {
      if (budget.status === 'active') budgets.update(budget.id, { ...budget, planId: null })
      else budgets.remove(budget.id)
    }
    plans.remove(plan.id)
    return ok({ id: plan.id })
  }),
]

// --- E-Budgeting, Budget Approvals ----------------------------------------------------------

const budgetSchema = z
  .object({
    amount: amount('Enter the budget amount').positive('Enter the budget amount'),
    startDate: day,
    endDate: day,
  })
  .refine((value) => value.endDate >= value.startDate, {
    path: ['endDate'],
    message: 'The end date cannot be before the start date',
  })

const STATUS_ORDER = { pending: 0, active: 1, rejected: 2 } as const

const budgetHandlers = [
  http.get(base('/budgets'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const search = param(url, 'search')
    const list = budgets
      .all()
      .map(budgetRow)
      .filter((row) =>
        contains(
          `${row.title} ${row.duration} ${row.planTitle ?? ''} ${String(row.amount)}`,
          search,
        ),
      )
      .sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.added.at.localeCompare(a.added.at),
      )
    return page(url, list)
  }),
  http.put(base('/budgets/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const budget = budgets.find(String(params.id))
    if (!budget) return notFound('budget')
    if (budget.status === 'active') {
      return conflict('An approved budget cannot be changed.', 'LOCKED')
    }
    const parsed = await readBody(request, budgetSchema)
    if (!parsed.success) return rejected(parsed.error)
    // A changed budget goes back for approval.
    const next: Budget = { ...budget, ...parsed.data, status: 'pending', decided: null }
    budgets.update(budget.id, next)
    syncPlanStatus(budget.planId)
    return ok(budgetRow(next))
  }),
  http.delete(base('/budgets/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const budget = budgets.find(String(params.id))
    if (!budget) return notFound('budget')
    if (budget.status === 'active') {
      return conflict('An approved budget cannot be deleted.', 'LOCKED')
    }
    budgets.remove(budget.id)
    syncPlanStatus(budget.planId)
    return ok({ id: budget.id })
  }),
  http.post(base('/budgets/:id/:decision'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const budget = budgets.find(String(params.id))
    if (!budget) return notFound('budget')
    const decision = String(params.decision)
    if (decision !== 'approve' && decision !== 'reject') return notFound('action')
    if (budget.status !== 'pending') {
      return conflict(
        `This budget was already ${budget.status === 'active' ? 'approved' : 'rejected'}.`,
        'DECIDED',
      )
    }
    const decided = stampNow()
    const next: Budget = {
      ...budget,
      status: decision === 'approve' ? 'active' : 'rejected',
      decided,
    }
    budgets.update(budget.id, next)
    if (decision === 'approve' && budget.positions > 0) {
      openPositions.insert({
        id: createId('op'),
        budgetId: budget.id,
        title: budget.title,
        totalPositions: budget.positions,
        endDate: budget.endDate,
        approved: decided,
        status: 'active',
      })
    }
    syncPlanStatus(budget.planId)
    return ok(budgetRow(next))
  }),
]

// --- Open Positions -------------------------------------------------------------------------

const openPositionSchema = z.object({
  totalPositions: z
    .number({ error: 'Enter the total positions' })
    .int('Enter a whole number')
    .min(1, 'At least one position')
    .max(999, 'Keep it under 1000'),
  endDate: day,
})

function jobDescription(open: OpenPosition): JobDescription {
  const matching = positions
    .all()
    .filter((position) => same(titleOf(position.positionTitleId), open.title))
  const lines = [
    `Job Description: ${open.title}`,
    '',
    `Total positions: ${String(open.totalPositions)}`,
    `Open until: ${formatDay(open.endDate)}`,
    `Approved by ${open.approved.byName}, ${open.approved.byRole}`,
    '',
    'Position details',
    ...(matching.length === 0
      ? ['- No employee position is set up for this title yet (E-Budget Settings).']
      : matching.map((position) =>
          [
            `- Position Code ${position.code}`,
            nameIn(DIVISIONS, position.divisionId),
            stationName(position.stationId),
            nameIn(DEPARTMENTS, position.departmentId),
            nameIn(SUB_DEPARTMENTS, position.subDepartmentId),
            `Employee Group ${nameIn(EMPLOYEE_GROUPS, position.employeeGroupId)}`,
            nameIn(GRADES, position.gradeId),
            `Salary ${String(position.minSalary)} to ${String(position.maxSalary)}`,
            position.reportsToId
              ? `Reports to ${findEmployee(position.reportsToId)?.name ?? ''}`
              : '',
          ]
            .filter(Boolean)
            .join(' | '),
        )),
  ]
  return {
    fileName: `JD - ${open.title.replace(/[\\/:*?"<>|]/g, '-')}.txt`,
    text: lines.join('\n'),
  }
}

const openPositionHandlers = [
  http.get(base('/open-positions'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const list = openPositions
      .all()
      .filter((row) => contains(row.title, param(url, 'search')))
      .sort(
        (a, b) =>
          (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) ||
          b.approved.at.localeCompare(a.approved.at),
      )
    return page(url, list)
  }),
  http.get(base('/open-positions/:id/jd'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const open = openPositions.find(String(params.id))
    return open ? ok(jobDescription(open)) : notFound('open position')
  }),
  http.put(base('/open-positions/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const open = openPositions.find(String(params.id))
    if (!open) return notFound('open position')
    const parsed = await readBody(request, openPositionSchema)
    if (!parsed.success) return rejected(parsed.error)
    const next = { ...open, ...parsed.data }
    openPositions.update(open.id, next)
    return ok(next)
  }),
  http.post(base('/open-positions/:id/:action'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const open = openPositions.find(String(params.id))
    if (!open) return notFound('open position')
    const action = String(params.action)
    if (action !== 'close' && action !== 'reopen') return notFound('action')
    const next: OpenPosition = { ...open, status: action === 'close' ? 'closed' : 'active' }
    openPositions.update(open.id, next)
    return ok(next)
  }),
]

// --- E-Budget Settings: Budget Duration -----------------------------------------------------

const durationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter the budget duration')
      .max(40, 'Keep it under 40 characters'),
    startDate: day,
    endDate: day,
    isCurrent: z.boolean(),
  })
  .refine((value) => value.endDate > value.startDate, {
    path: ['endDate'],
    message: 'The end date must be after the start date',
  })

/** Only one duration is the current budget period. */
function saveDuration(duration: BudgetDuration) {
  if (duration.isCurrent) {
    for (const other of durations.all()) {
      if (other.id !== duration.id && other.isCurrent) {
        durations.update(other.id, { ...other, isCurrent: false })
      }
    }
  }
}

const durationHandlers = [
  http.get(base('/durations'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const list = durations
      .all()
      .filter((row) => contains(row.name, param(url, 'search')))
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
    return page(url, list)
  }),
  http.post(base('/durations'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, durationSchema)
    if (!parsed.success) return rejected(parsed.error)
    if (durations.all().some((item) => same(item.name, parsed.data.name))) {
      const message = 'A budget duration with this name already exists'
      return conflict(message, 'DUPLICATE', { name: message })
    }
    const duration: BudgetDuration = { ...parsed.data, id: createId('bd'), added: stampNow() }
    durations.insert(duration)
    saveDuration(duration)
    return ok(duration)
  }),
  http.put(base('/durations/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const existing = durations.find(String(params.id))
    if (!existing) return notFound('budget duration')
    const parsed = await readBody(request, durationSchema)
    if (!parsed.success) return rejected(parsed.error)
    if (
      durations.all().some((item) => item.id !== existing.id && same(item.name, parsed.data.name))
    ) {
      const message = 'A budget duration with this name already exists'
      return conflict(message, 'DUPLICATE', { name: message })
    }
    const duration = { ...existing, ...parsed.data }
    durations.update(existing.id, duration)
    saveDuration(duration)
    return ok(duration)
  }),
  http.delete(base('/durations/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const duration = durations.find(String(params.id))
    if (!duration) return notFound('budget duration')
    const planCount = plans.all().filter((plan) => plan.durationId === duration.id).length
    const budgetCount = budgets.all().filter((budget) => budget.durationId === duration.id).length
    if (planCount + budgetCount > 0) {
      return conflict(
        `${duration.name} is the plan year of ${plural(planCount, 'plan')} and ${plural(budgetCount, 'budget')}; it cannot be deleted.`,
        'IN_USE',
      )
    }
    durations.remove(duration.id)
    return ok({ id: duration.id })
  }),
]

// --- E-Budget Settings: Position Title ------------------------------------------------------

const positionTitleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Enter the position title')
    .max(60, 'Keep it under 60 characters'),
})

const duplicateTitle = (title: string, id: string | null) =>
  positionTitles.all().some((item) => item.id !== id && same(item.title, title))

const positionTitleHandlers = [
  http.get(base('/position-titles'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const status = param(url, 'status')
    const list = positionTitles
      .all()
      .filter(
        (row) =>
          contains(row.title, param(url, 'title')) &&
          contains(row.title, param(url, 'search')) &&
          (!status || (status === 'active') === row.active),
      )
      .sort((a, b) => b.added.at.localeCompare(a.added.at))
    return page(url, list)
  }),
  http.post(base('/position-titles'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, positionTitleSchema)
    if (!parsed.success) return rejected(parsed.error)
    if (duplicateTitle(parsed.data.title, null)) {
      const message = 'This position title already exists'
      return conflict(message, 'DUPLICATE', { title: message })
    }
    const stamp = stampNow()
    const title = {
      id: createId('pt'),
      title: parsed.data.title,
      active: true,
      added: stamp,
      modified: stamp,
    }
    positionTitles.insert(title)
    return ok(title)
  }),
  http.put(base('/position-titles/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const existing = positionTitles.find(String(params.id))
    if (!existing) return notFound('position title')
    const parsed = await readBody(request, positionTitleSchema)
    if (!parsed.success) return rejected(parsed.error)
    if (duplicateTitle(parsed.data.title, existing.id)) {
      const message = 'This position title already exists'
      return conflict(message, 'DUPLICATE', { title: message })
    }
    const title = { ...existing, title: parsed.data.title, modified: stampNow() }
    positionTitles.update(existing.id, title)
    return ok(title)
  }),
  http.post(base('/position-titles/:id/:action'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const existing = positionTitles.find(String(params.id))
    if (!existing) return notFound('position title')
    const action = String(params.action)
    if (action !== 'activate' && action !== 'deactivate') return notFound('action')
    const title = { ...existing, active: action === 'activate', modified: stampNow() }
    positionTitles.update(existing.id, title)
    return ok(title)
  }),
  http.delete(base('/position-titles/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const title = positionTitles.find(String(params.id))
    if (!title) return notFound('position title')
    const used = positions.all().filter((item) => item.positionTitleId === title.id).length
    if (used > 0) {
      return conflict(
        `${title.title} is the title of ${plural(used, 'employee position')}; it cannot be deleted.`,
        'IN_USE',
      )
    }
    positionTitles.remove(title.id)
    return ok({ id: title.id })
  }),
]

// --- E-Budget Settings: Employee Position ---------------------------------------------------

const positionSchema = z
  .object({
    code: z.string().trim().max(20, 'Keep it under 20 characters'),
    positionTitleId: z.string().min(1, 'Choose the position title'),
    divisionId: nullableId,
    stationId: z.string().min(1, 'Choose the station'),
    departmentId: nullableId,
    subDepartmentId: nullableId,
    employeeGroupId: z.string().min(1, 'Choose the employee group'),
    costCenterId: nullableId,
    gradeId: nullableId,
    reportsToId: nullableId,
    minSalary: amount('Enter the minimum salary'),
    maxSalary: amount('Enter the maximum salary').positive('Enter the maximum salary'),
  })
  .refine((value) => value.minSalary <= value.maxSalary, {
    path: ['minSalary'],
    message: 'The minimum salary cannot be above the maximum',
  })
type PositionBody = z.infer<typeof positionSchema>

const positionRow = (position: EmployeePosition): EmployeePositionRow => ({
  ...position,
  positionTitle: titleOf(position.positionTitleId),
})

const nextPositionCode = () =>
  String(
    positions.all().reduce((max, item) => {
      const number = Number(item.code)
      return Number.isInteger(number) && number > max ? number : max
    }, 12211) + 1,
  )

/** References that must exist; the field and message of the first that does not. */
function checkPosition(body: PositionBody, id: string | null): Response | null {
  if (!positionTitles.find(body.positionTitleId)) {
    return invalid('Choose the position title', { positionTitleId: 'Choose the position title' })
  }
  if (!stationOptions().some((item) => item.id === body.stationId)) {
    return invalid('Choose the station', { stationId: 'Choose the station' })
  }
  const subDepartment = SUB_DEPARTMENTS.find((item) => item.id === body.subDepartmentId)
  if (body.subDepartmentId && subDepartment?.departmentId !== body.departmentId) {
    const message = 'Choose a sub-department of the department'
    return invalid(message, { subDepartmentId: message })
  }
  if (body.code && positions.all().some((item) => item.id !== id && item.code === body.code)) {
    const message = 'Another employee position has this code'
    return conflict(message, 'DUPLICATE', { code: message })
  }
  return null
}

const importRowSchema = z.object({
  code: z.string(),
  positionTitle: z.string(),
  division: z.string(),
  station: z.string(),
  department: z.string(),
  subDepartment: z.string(),
  employeeGroup: z.string(),
  costCenter: z.string(),
  grade: z.string(),
  reportsTo: z.string(),
  minSalary: z.number(),
  maxSalary: z.number(),
})

/** An Upload Excel line by names → the position body, or the reason it cannot be read. */
function fromImportRow(row: z.infer<typeof importRowSchema>): PositionBody | string {
  const problems: string[] = []
  /** The id of a name in a list; null when the cell is blank, noted when it is unknown. */
  const pick = (list: readonly { id: string; name: string }[], value: string, what: string) => {
    if (!value.trim()) return null
    const found = list.find((item) => same(item.name, value))
    if (!found) problems.push(`unknown ${what} "${value}"`)
    return found?.id ?? null
  }
  const title = positionTitles.all().find((item) => same(item.title, row.positionTitle))
  if (!title) return `unknown position title "${row.positionTitle}"`
  const body = {
    code: row.code.trim(),
    positionTitleId: title.id,
    divisionId: pick(DIVISIONS, row.division, 'division'),
    stationId: pick(stationOptions(), row.station, 'station'),
    departmentId: pick(DEPARTMENTS, row.department, 'department'),
    subDepartmentId: pick(SUB_DEPARTMENTS, row.subDepartment, 'sub-department'),
    employeeGroupId: pick(EMPLOYEE_GROUPS, row.employeeGroup, 'employee group'),
    costCenterId: pick(COST_CENTERS, row.costCenter, 'cost center'),
    gradeId: pick(GRADES, row.grade, 'grade'),
    reportsToId: pick(DIRECTORY, row.reportsTo, 'person'),
    minSalary: row.minSalary,
    maxSalary: row.maxSalary,
  }
  if (problems[0]) return problems[0]
  if (!body.stationId) return 'the station is missing'
  if (!body.employeeGroupId) return 'the employee group is missing'
  return { ...body, stationId: body.stationId, employeeGroupId: body.employeeGroupId }
}

function createPosition(body: PositionBody): EmployeePosition {
  const stamp = stampNow()
  const position: EmployeePosition = {
    ...body,
    code: body.code || nextPositionCode(),
    id: createId('ep'),
    active: true,
    added: stamp,
    modified: stamp,
  }
  positions.insert(position)
  return position
}

const positionHandlers = [
  http.get(base('/positions'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const is = (field: keyof EmployeePosition, value: string | null) => {
      const wanted = param(url, field)
      return !wanted || wanted === value
    }
    const status = param(url, 'status')
    const list = positions
      .all()
      .filter(
        (row) =>
          contains(row.code, param(url, 'code')) &&
          is('divisionId', row.divisionId) &&
          is('stationId', row.stationId) &&
          is('departmentId', row.departmentId) &&
          is('subDepartmentId', row.subDepartmentId) &&
          is('employeeGroupId', row.employeeGroupId) &&
          is('costCenterId', row.costCenterId) &&
          is('positionTitleId', row.positionTitleId) &&
          is('reportsToId', row.reportsToId) &&
          is('gradeId', row.gradeId) &&
          (!status || (status === 'active') === row.active),
      )
      .sort((a, b) => b.added.at.localeCompare(a.added.at))
      .map(positionRow)
    return page(url, list)
  }),
  http.post(base('/positions'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, positionSchema)
    if (!parsed.success) return rejected(parsed.error)
    const problem = checkPosition(parsed.data, null)
    if (problem) return problem
    return ok(positionRow(createPosition(parsed.data)))
  }),
  http.post(base('/positions/import'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, z.object({ rows: z.array(importRowSchema).max(500) }))
    if (!parsed.success) return rejected(parsed.error)
    const errors: string[] = []
    let created = 0
    for (const [index, row] of parsed.data.rows.entries()) {
      const label = `Line ${String(index + 2)}`
      const body = fromImportRow(row)
      if (typeof body === 'string') {
        errors.push(`${label}: ${body}`)
        continue
      }
      const valid = positionSchema.safeParse(body)
      if (!valid.success) {
        errors.push(`${label}: ${valid.error.issues[0]?.message ?? 'not valid'}`)
        continue
      }
      if (checkPosition(valid.data, null)) {
        errors.push(`${label}: the code ${valid.data.code} is already used`)
        continue
      }
      createPosition(valid.data)
      created += 1
    }
    return ok({ created, errors })
  }),
  http.put(base('/positions/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const existing = positions.find(String(params.id))
    if (!existing) return notFound('employee position')
    const parsed = await readBody(request, positionSchema)
    if (!parsed.success) return rejected(parsed.error)
    const problem = checkPosition(parsed.data, existing.id)
    if (problem) return problem
    const position: EmployeePosition = {
      ...existing,
      ...parsed.data,
      code: parsed.data.code || existing.code,
      modified: stampNow(),
    }
    positions.update(existing.id, position)
    return ok(positionRow(position))
  }),
  http.post(base('/positions/:id/:action'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const existing = positions.find(String(params.id))
    if (!existing) return notFound('employee position')
    const action = String(params.action)
    if (action !== 'activate' && action !== 'deactivate') return notFound('action')
    const position = { ...existing, active: action === 'activate', modified: stampNow() }
    positions.update(existing.id, position)
    return ok(positionRow(position))
  }),
  http.delete(base('/positions/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const position = positions.find(String(params.id))
    if (!position) return notFound('employee position')
    const plan = plans
      .all()
      .find((item) => item.newPositions.some((line) => line.positionId === position.id))
    if (plan) {
      return conflict(`This position is planned in ${plan.title}; deactivate it instead.`, 'IN_USE')
    }
    positions.remove(position.id)
    return ok({ id: position.id })
  }),
]

// --- registration ---------------------------------------------------------------------------

const lookupHandlers = [
  http.get(base('/lookups'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    return ok(lookups())
  }),
]

/** Manpower Planning mock API: settings, plans, budgets, approvals and open positions. */
export const manpowerPlanningHandlers: HttpHandler[] = [
  ...lookupHandlers,
  ...planHandlers,
  ...budgetHandlers,
  ...openPositionHandlers,
  ...durationHandlers,
  ...positionTitleHandlers,
  ...positionHandlers,
]

export function resetManpowerPlanningDb(): void {
  resetManpowerCollections()
}
