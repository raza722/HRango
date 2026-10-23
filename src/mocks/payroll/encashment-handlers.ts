import { endOfMonth, format, parse } from 'date-fns'
import { http } from 'msw'
import { z } from 'zod'

import {
  ENCASHMENT_BASES,
  ENCASHMENT_BASIS_RATES,
  ENCASHMENT_TYPES,
  type EncashmentBasis,
  type LeaveEncashment,
  type LeaveEncashmentDetail,
  type LeaveEncashmentInput,
  type LeaveEncashmentLine,
  type LeaveEncashmentRow,
} from '@/features/payroll'

import { DIRECTORY, findEmployee } from '../employees/seed'
import { createId, latency, requireAuth } from '../utils'
import {
  accountEntries,
  accountTypes,
  currentPayrollSettings,
  leaveEncashments,
  payslips,
  vouchers,
} from './db'
import {
  employeeRef,
  ensurePayrollRuns,
  isActive,
  refreshPayslips,
  salaryOn,
  shiftHours,
} from './engine'
import {
  base,
  conflict,
  invalid,
  nextCode,
  notFound,
  numberParam,
  ok,
  page,
  param,
  readBody,
  rejected,
} from './http'
import { personMatches } from './records-handlers'
import { encashmentEntryId, encashmentVoucherId, thisMonth } from './seed'

const authed = async (request: Request) => {
  await latency()
  ensurePayrollRuns()
  return requireAuth(request)
}

const pad = (month: number) => String(month).padStart(2, '0')
const today = () => format(new Date(), 'yyyy-MM-dd')
const monthName = (month: string) => format(parse(month, 'yyyy-MM', new Date()), 'MMMM, yyyy')
const leaveName = (id: string) => accountTypes.find(id)?.name ?? '—'

/** The months of a leave year, from Payroll Settings → Leave Configuration. */
function leaveYearMonths(year: number): { from: string; to: string } {
  const { fiscalYear, yearStartMonth, yearEndMonth } = currentPayrollSettings().leave
  if (fiscalYear === 'calendar') return { from: `${year}-01`, to: `${year}-12` }
  const endYear = yearEndMonth < yearStartMonth ? year + 1 : year
  return { from: `${year}-${pad(yearStartMonth)}`, to: `${endYear}-${pad(yearEndMonth)}` }
}

/** The leave year this month falls in. */
function currentLeaveYear(): number {
  const now = thisMonth()
  const year = Number(now.slice(0, 4))
  return leaveYearMonths(year).from <= now ? year : year - 1
}

const ownEntry = (encashmentId: string) => `ae_le_${encashmentId}_`
const ownVoucher = (encashmentId: string) => `vc_le_${encashmentId}_`

/**
 * Leave days left: the Leave Quotas account's credits less its debits in the
 * leave year. `ignore` leaves out an encashment's own debits (when it is edited).
 */
function daysLeft(employeeId: string, leaveTypeId: string, year: number, ignore?: string) {
  const { from, to } = leaveYearMonths(year)
  return accountEntries
    .all()
    .filter(
      (entry) =>
        entry.employeeId === employeeId &&
        entry.accountTypeId === leaveTypeId &&
        entry.month >= from &&
        entry.month <= to &&
        !(ignore && entry.id.startsWith(ownEntry(ignore))),
    )
    .reduce((sum, entry) => sum + (entry.direction === 'credit' ? entry.amount : -entry.amount), 0)
}

/**
 * What one leave day is paid: a day's gross salary (÷ 30), or the hourly rate
 * (a day ÷ 8) for the person's shift hours at the basis's multiple. The salary
 * is the one at the end of the leave year, or today while the year runs.
 */
function amountPerLeave(employeeId: string, basis: EncashmentBasis, year: number): number {
  const { to } = leaveYearMonths(year)
  const yearEnd = format(endOfMonth(parse(to, 'yyyy-MM', new Date())), 'yyyy-MM-dd')
  const date = yearEnd < today() ? yearEnd : today()
  const day = salaryOn(employeeId, date) / 30
  const rate = ENCASHMENT_BASIS_RATES[basis]
  return Math.round(
    rate.perShiftHour ? (day / 8) * shiftHours(employeeId, date) * rate.times : day * rate.times,
  )
}

/** One line per person with days left; Payroll pays a day's salary per leave. */
function linesFor(input: LeaveEncashmentInput, ignore?: string): LeaveEncashmentLine[] {
  const people = input.allEmployees
    ? DIRECTORY.filter((employee) => isActive(employee.id)).map((employee) => employee.id)
    : input.employeeIds
  const basis = input.type === 'manual' ? (input.basis ?? 'overtime') : 'earned-salary'
  return people.flatMap((employeeId) => {
    const days = daysLeft(employeeId, input.leaveTypeId, input.year, ignore)
    return days > 0
      ? [{ employeeId, days, amountPerLeave: amountPerLeave(employeeId, basis, input.year) }]
      : []
  })
}

/** Paid: a payroll encashment is in a released pay slip of its month. */
function isPaid(item: LeaveEncashment): boolean {
  if (item.type !== 'payroll') return false
  const people = new Set(item.lines.map((line) => line.employeeId))
  return payslips
    .all()
    .some(
      (slip) =>
        people.has(slip.employeeId) &&
        slip.month === item.payMonth &&
        (slip.status === 'released' || slip.status === 'released-fs') &&
        slip.items.some((entry) => entry.payItemId === 'pi_leave_encashment' && entry.value > 0),
    )
}

/** Take the encashment's debits off the leave quotas, and its voucher lines off Vouchers. */
function clearEffects(id: string) {
  for (const entry of accountEntries.all()) {
    if (entry.id.startsWith(ownEntry(id))) accountEntries.remove(entry.id)
  }
  for (const voucher of vouchers.all()) {
    if (voucher.id.startsWith(ownVoucher(id))) vouchers.remove(voucher.id)
  }
}

/**
 * The paid days come off each person's leave quota (a debit in the pay month,
 * kept inside the leave year); Manually adds a voucher line per person.
 */
function applyEffects(item: LeaveEncashment) {
  const { from, to } = leaveYearMonths(item.year)
  const month = item.payMonth < from ? from : item.payMonth > to ? to : item.payMonth
  for (const line of item.lines) {
    accountEntries.insert({
      id: encashmentEntryId(item.id, line.employeeId),
      employeeId: line.employeeId,
      accountTypeId: item.leaveTypeId,
      month,
      direction: 'debit',
      amount: line.days,
      processed: true,
    })
    if (item.type === 'manual') {
      vouchers.insert({
        id: encashmentVoucherId(item.id, line.employeeId),
        code: nextCode(
          '',
          vouchers.all().map((voucher) => voucher.code),
          1,
        ),
        employeeId: line.employeeId,
        amount: line.days * line.amountPerLeave,
        date: today(),
        type: 'leave-encashment',
      })
    }
  }
}

const detail = (item: LeaveEncashment): LeaveEncashmentDetail => ({
  ...item,
  leave: leaveName(item.leaveTypeId),
  paid: isPaid(item),
})

const rowsOf = (item: LeaveEncashment): LeaveEncashmentRow[] =>
  item.lines.map((line) => ({
    id: `${item.id}:${line.employeeId}`,
    encashmentId: item.id,
    leave: leaveName(item.leaveTypeId),
    employee: employeeRef(line.employeeId),
    year: item.year,
    days: line.days,
    amountPerLeave: line.amountPerLeave,
    people: item.lines.length,
  }))

const schema = z
  .object({
    leaveTypeId: z
      .string()
      .min(1, 'Choose the leave type')
      .refine((id) => accountTypes.find(id)?.category === 'leave-quotas', {
        message: 'Choose the leave type',
      }),
    allEmployees: z.boolean(),
    employeeIds: z.array(z.string()).max(500),
    year: z
      .number({ error: 'Choose the year' })
      .int('Choose the year')
      .min(2000, 'Choose the year')
      .max(2100, 'Choose the year'),
    type: z.enum(ENCASHMENT_TYPES),
    basis: z.enum(ENCASHMENT_BASES).nullable(),
  })
  .refine((value) => value.allEmployees || value.employeeIds.length > 0, {
    message: 'Choose the employees',
    path: ['employeeIds'],
  })
  .refine((value) => value.employeeIds.every((id) => Boolean(findEmployee(id))), {
    message: 'Choose the employees',
    path: ['employeeIds'],
  })
  .refine((value) => value.type === 'payroll' || value.basis !== null, {
    message: 'Choose the amount per leave',
    path: ['basis'],
  })
  .refine((value) => value.year <= currentLeaveYear(), {
    message: 'That leave year has not started yet',
    path: ['year'],
  })

const nobodyLeft = (input: LeaveEncashmentInput) =>
  invalid(
    `${input.allEmployees ? 'Nobody' : 'Nobody chosen'} has ${leaveName(input.leaveTypeId)} left in ${String(input.year)}.`,
  )

const paidConflict = (item: LeaveEncashment) =>
  conflict(
    `This encashment was paid in the ${monthName(item.payMonth)} payroll and cannot be changed.`,
    'PAID',
  )

const people = (item: LeaveEncashment | undefined) =>
  item ? item.lines.map((line) => line.employeeId) : []

export const payrollEncashmentHandlers = [
  http.get(base('/leave-encashments'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const leaveTypeId = param(url, 'leaveTypeId')
    const year = numberParam(url, 'year')
    const list = leaveEncashments
      .all()
      .filter(
        (item) =>
          (!leaveTypeId || item.leaveTypeId === leaveTypeId) &&
          (year === undefined || item.year === year),
      )
      .sort((a, b) => b.code.localeCompare(a.code))
      .flatMap((item) =>
        rowsOf(item)
          .filter((row) => personMatches(url, row.employee.id))
          .sort((a, b) => a.employee.name.localeCompare(b.employee.name)),
      )
    return page(url, list)
  }),
  http.get(base('/leave-encashments/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const item = leaveEncashments.find(String(params.id))
    return item ? ok(detail(item)) : notFound('leave encashment')
  }),
  http.post(base('/leave-encashments'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, schema)
    if (!parsed.success) return rejected(parsed.error)
    const input = parsed.data
    const lines = linesFor(input)
    if (lines.length === 0) return nobodyLeft(input)
    const item: LeaveEncashment = {
      id: createId('le'),
      code: nextCode(
        'LE-',
        leaveEncashments.all().map((entry) => entry.code),
      ),
      ...input,
      employeeIds: input.allEmployees ? [] : input.employeeIds,
      basis: input.type === 'manual' ? input.basis : null,
      lines,
      payMonth: thisMonth(),
      createdAt: new Date().toISOString(),
    }
    leaveEncashments.insert(item)
    applyEffects(item)
    if (item.type === 'payroll') refreshPayslips(people(item), item.payMonth)
    return ok(detail(item))
  }),
  http.put(base('/leave-encashments/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const existing = leaveEncashments.find(String(params.id))
    if (!existing) return notFound('leave encashment')
    if (isPaid(existing)) return paidConflict(existing)
    const parsed = await readBody(request, schema)
    if (!parsed.success) return rejected(parsed.error)
    const input = parsed.data
    const lines = linesFor(input, existing.id)
    if (lines.length === 0) return nobodyLeft(input)
    const item: LeaveEncashment = {
      ...existing,
      ...input,
      employeeIds: input.allEmployees ? [] : input.employeeIds,
      basis: input.type === 'manual' ? input.basis : null,
      lines,
    }
    clearEffects(existing.id)
    leaveEncashments.update(existing.id, item)
    applyEffects(item)
    refreshPayslips([...people(existing), ...people(item)], item.payMonth)
    return ok(detail(item))
  }),
  http.delete(base('/leave-encashments/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const existing = leaveEncashments.find(String(params.id))
    if (!existing) return notFound('leave encashment')
    if (isPaid(existing)) return paidConflict(existing)
    clearEffects(existing.id)
    leaveEncashments.remove(existing.id)
    refreshPayslips(people(existing), existing.payMonth)
    return ok({ id: existing.id })
  }),
]
