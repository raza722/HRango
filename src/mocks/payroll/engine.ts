import { endOfMonth, format, getDaysInMonth, parse, subMonths } from 'date-fns'

import type {
  DailyWageBatch,
  DailyWageRow,
  EmployeeProfile,
  EmployeeRef,
  MonthAmount,
  Payroll,
  PayrollError,
  Payslip,
  PayslipItem,
  TaxStructure,
  TimeSlot,
} from '@/features/payroll'

import {
  computeDay,
  computeRange,
  monthRange,
  type Snapshot,
  takeSnapshot,
} from '../attendance/engine'
import { toProfile } from '../attendance/seed'
import { DIRECTORY, findEmployee } from '../employees/seed'
import { enrollments, rosterGroups } from '../roster/handlers'
import { profileOf } from '../scheduling/seed'
import {
  accountEntries,
  currentPayrollSettings,
  employeeVouchers,
  formulas,
  leaveEncashments,
  onPayrollReset,
  openingBalances,
  payItems,
  payrolls,
  payslips,
  salaryRevisions,
  taxStructures,
  vouchers,
} from './db'
import { evaluate, ExpressionError } from './expression'
import { baseSalaryOf, lastMonth, STANDARD_PAY_ITEMS, thisMonth } from './seed'

// --- people ----------------------------------------------------------------------------------

export function employeeRef(id: string): EmployeeRef {
  const employee = findEmployee(id)
  if (!employee) {
    return { id, name: 'Unknown', code: id, department: '', designation: '', photoUrl: null }
  }
  const profile = toProfile(employee)
  return {
    id,
    name: employee.name,
    code: profile.code,
    department: employee.department,
    designation: employee.jobTitle,
    photoUrl: profile.photoUrl,
  }
}

export function employeeProfile(id: string): EmployeeProfile {
  const employee = findEmployee(id)
  const ref = employeeRef(id)
  if (!employee) return { ...ref, location: null, branch: null, company: null, joiningDate: '' }
  const profile = toProfile(employee)
  return {
    ...ref,
    location: profile.location,
    branch: profile.branch,
    company: profile.company,
    joiningDate: profile.joiningDate,
  }
}

export const isActive = (id: string) => {
  const employee = findEmployee(id)
  return employee ? profileOf(employee).status === 'active' : false
}

/** Monthly gross on a date: the latest revision in effect, or the starting salary. */
export function salaryOn(employeeId: string, date: string): number {
  const revision = salaryRevisions
    .all()
    .filter((item) => item.employeeId === employeeId && item.effectiveDate <= date)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0]
  if (revision) return revision.salary
  const employee = findEmployee(employeeId)
  return employee ? baseSalaryOf(employee) : 0
}

/** Daily-wage time slots: one per roster group, with its usual times. */
export function timeSlots(): TimeSlot[] {
  return rosterGroups
    .all()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((group, index) => {
      const first = group.days.find((day) => !day.isWeekend && day.clockIn && day.clockOut)
      return {
        id: group.id,
        code: `TS-${String(index + 1).padStart(5, '0')}`,
        name: group.title,
        clockIn: group.clockIn ?? first?.clockIn ?? '09:00',
        clockOut: group.clockOut ?? first?.clockOut ?? '17:00',
      }
    })
}

export const minutesOf = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export const slotMinutes = (slot: TimeSlot) => {
  const span = minutesOf(slot.clockOut) - minutesOf(slot.clockIn)
  return span <= 0 ? span + 24 * 60 : span
}

/** Hours of the person's roster shift on a date; 8 when they are on no roster. */
export function shiftHours(employeeId: string, date: string): number {
  const enrollment = enrollments
    .all()
    .find(
      (item) =>
        item.employeeId === employeeId &&
        item.startDate <= date &&
        (item.endDate === null || item.endDate >= date),
    )
  const slot = enrollment ? timeSlots().find((item) => item.id === enrollment.rosterGroupId) : null
  return slot ? slotMinutes(slot) / 60 : 8
}

/** Payroll-type leave encashments paid to the person in that month's payroll. */
export function leaveEncashmentDue(employeeId: string, month: string): number {
  return leaveEncashments
    .all()
    .filter((item) => item.type === 'payroll' && item.payMonth === month)
    .flatMap((item) => item.lines)
    .filter((line) => line.employeeId === employeeId)
    .reduce((sum, line) => sum + line.days * line.amountPerLeave, 0)
}

// --- tax -------------------------------------------------------------------------------------

/** Yearly tax on a yearly taxable income from the structure's slabs (and surcharge). */
export function annualTax(income: number, structure: TaxStructure | undefined): number {
  if (!structure || income <= 0) return 0
  const slab = structure.slabs.find(
    (item) => income >= item.min && (item.max === null || income <= item.max),
  )
  if (!slab) return 0
  const base =
    slab.fixedAmount + Math.max(0, income - Math.max(0, slab.min - 1)) * (slab.percentage / 100)
  const rule = structure.surchargeRule
  if (structure.surcharge && rule) {
    const hit =
      (rule.condition === '>' && base > rule.amount) ||
      (rule.condition === '>=' && base >= rule.amount) ||
      (rule.condition === '<' && base < rule.amount) ||
      (rule.condition === '<=' && base <= rule.amount)
    if (hit) return base + (rule.rate === 'percentage' ? (base * rule.value) / 100 : rule.value)
  }
  return base
}

function round(value: number, mode: string | null): number {
  if (mode === 'floor') return Math.floor(value)
  if (mode === 'ceil') return Math.ceil(value)
  if (mode === 'as-per-actual') return Math.round(value * 100) / 100
  return Math.round(value)
}

// --- the month's numbers --------------------------------------------------------------------

/** The variables an expression can use, from the person's attendance in the month. */
export function monthVariables(
  snap: Snapshot,
  payroll: Pick<Payroll, 'applicableDays' | 'fixedDays'>,
  employeeId: string,
  month: string,
  until?: string,
): Record<string, number> {
  const { from, to } = monthRange(month)
  const last = [to, until ?? to, snap.today].sort()[0] ?? to
  const days =
    last >= from ? computeRange(snap, employeeId, from, last).map((item) => item.day) : []
  const count = (test: (day: (typeof days)[number]) => boolean) => days.filter(test).length
  const actualDays = getDaysInMonth(parse(month, 'yyyy-MM', new Date()))
  const applicableDays =
    payroll.applicableDays === 'fixed' && payroll.fixedDays ? payroll.fixedDays : actualDays
  const absentDays = count((day) => day.status === 'absent')
  const monthEnd = format(endOfMonth(parse(month, 'yyyy-MM', new Date())), 'yyyy-MM-dd')
  let gross = salaryOn(employeeId, until ?? monthEnd)
  // A final settlement pays the month up to the last working day.
  if (until && until < monthEnd) gross = (gross * Number(until.slice(8, 10))) / actualDays
  return {
    gross_salary: Math.round(gross),
    applicable_days: applicableDays,
    worked_days: Math.max(0, applicableDays - absentDays),
    absent_days: absentDays,
    leave_days: count((day) => day.status === 'leave' || day.status === 'leave-applied'),
    half_days: count((day) => day.status === 'half-day' || day.status === 'half-leave'),
    short_days: count((day) => day.status === 'short-day' || day.status === 'short-leave'),
    late_days: count((day) => day.status === 'late-arrival'),
    late_minutes: days.reduce((sum, day) => sum + day.lateMinutes, 0),
    early_left_days: count((day) => day.status === 'early-left'),
    missing_punch_days: count(
      (day) => day.checkIn !== null && day.checkOut === null && day.date < snap.today,
    ),
    overtime_minutes: days.reduce(
      (sum, day) => sum + (day.approvedOvertimeMinutes ?? day.overtimeMinutes),
      0,
    ),
    relaxation_days: count((day) => day.relaxed),
    penalty_count: count((day) => Boolean(day.warning?.penalty)),
    leave_encashment: Math.round(leaveEncashmentDue(employeeId, month)),
  }
}

type PayrollLike = Pick<
  Payroll,
  'id' | 'payItems' | 'applicableDays' | 'fixedDays' | 'taxApplicable' | 'taxStructureId'
>

/**
 * One person's pay slip for a month: every pay item of the payroll from its
 * expression (or formula), manual items and manual edits kept from before,
 * opening-balance amounts added. An expression that cannot be worked out is
 * the run's error for that person.
 */
export function computePayslip(
  payroll: PayrollLike,
  employeeId: string,
  month: string,
  snap: Snapshot,
  previous?: Payslip,
  until?: string,
): { payslip: Payslip } | { error: PayrollError } {
  const variables = monthVariables(snap, payroll, employeeId, month, until)
  const structure = payroll.taxStructureId ? taxStructures.find(payroll.taxStructureId) : undefined
  const settings = currentPayrollSettings().configuration
  const items: PayslipItem[] = []
  const name = findEmployee(employeeId)?.name ?? employeeId

  // Taxable pay for the year: the taxable earnings of the month × 12.
  const taxableRows = payroll.payItems.filter((row) => row.taxable)
  let taxableMonthly = variables.gross_salary ?? 0
  try {
    const sumTaxable = taxableRows.reduce((sum, row) => {
      const item = payItems.find(row.payItemId)
      if (item?.type !== 'earning' || !item.expression) return sum
      return sum + evaluate(item.expression, variables)
    }, 0)
    if (sumTaxable > 0) taxableMonthly = sumTaxable
  } catch {
    // Reported below, on the pay item that fails.
  }
  const yearly = payroll.taxApplicable ? annualTax(taxableMonthly * 12, structure) : 0
  const scope = {
    ...variables,
    annual_tax: round(yearly, settings.roundOffTaxAmount),
    monthly_tax: round(yearly / 12, settings.roundOffTaxAmount),
  }

  for (const row of payroll.payItems) {
    const item = payItems.find(row.payItemId)
    if (!item) continue
    const prior = previous?.items.find((entry) => entry.payItemId === item.id)
    if (prior?.manuallyUpdated) {
      items.push({ ...prior, name: item.name, type: item.type })
      continue
    }
    let value: number
    let employer: number | null = null
    try {
      if (item.calculationType === 'manual') {
        value = prior?.value ?? 0
      } else {
        const formula = item.employeeFormulaId ? formulas.find(item.employeeFormulaId) : undefined
        value = Math.round(evaluate(formula?.expression ?? item.expression, scope))
      }
      if (item.employerContribution) {
        const employerFormula = item.employerFormulaId
          ? formulas.find(item.employerFormulaId)
          : undefined
        employer = employerFormula ? Math.round(evaluate(employerFormula.expression, scope)) : value
      }
    } catch (error) {
      return {
        error: {
          employeeId,
          employeeName: name,
          message:
            error instanceof ExpressionError
              ? error.message
              : 'The pay item could not be calculated',
        },
      }
    }
    const opening = openingBalances
      .all()
      .filter((balance) => balance.employeeId === employeeId)
      .flatMap((balance) => balance.items)
      .filter((entry) => entry.payItemId === item.id && entry.month === month)
      .reduce((sum, entry) => sum + entry.amount, 0)
    value += opening
    items.push({
      payItemId: item.id,
      name: item.name,
      type: item.type,
      value: Math.max(0, value),
      employeeContribution: item.employerContribution ? Math.max(0, value) : null,
      employerContribution: employer,
      manuallyUpdated: false,
    })
  }

  // A leave encashment due this month is paid even when the payroll does not list the pay item.
  const encashment = variables.leave_encashment ?? 0
  const encashmentItem = payItems.find('pi_leave_encashment')
  if (
    encashment > 0 &&
    encashmentItem &&
    !items.some((item) => item.payItemId === 'pi_leave_encashment')
  ) {
    items.push({
      payItemId: encashmentItem.id,
      name: encashmentItem.name,
      type: encashmentItem.type,
      value: encashment,
      employeeContribution: null,
      employerContribution: null,
      manuallyUpdated: false,
    })
  }

  return {
    payslip: withTotals({
      id: previous?.id ?? payslipId(payroll.id, employeeId, month),
      payrollId: payroll.id,
      employeeId,
      month,
      salary: variables.gross_salary ?? 0,
      items,
      earnings: 0,
      deductions: 0,
      reimbursements: 0,
      netPayable: 0,
      status: previous?.status ?? 'ready',
      changes: previous?.changes ?? [],
    }),
  }
}

export const payslipId = (payrollId: string, employeeId: string, month: string) =>
  `ps_${payrollId}_${employeeId}_${month}`

/** Earnings, deductions, reimbursements and net pay from the items. */
export function withTotals(payslip: Payslip): Payslip {
  const sum = (type: PayslipItem['type']) =>
    payslip.items
      .filter((item) => item.type === type)
      .reduce((total, item) => total + item.value, 0)
  const earnings = sum('earning')
  const deductions = sum('deduction')
  const reimbursements = sum('reimbursement')
  return {
    ...payslip,
    earnings,
    deductions,
    reimbursements,
    netPayable: earnings - deductions + reimbursements,
  }
}

function upsert(payslip: Payslip) {
  if (payslips.find(payslip.id)) payslips.update(payslip.id, payslip)
  else payslips.insert(payslip)
}

/**
 * Run a payroll for its month: work out every person's pay slip. Released
 * slips stay as they are; slips put on hold stay on hold.
 */
export function runPayroll(payroll: Payroll, snap: Snapshot = takeSnapshot()): PayrollError[] {
  const errors: PayrollError[] = []
  for (const employeeId of payroll.employeeIds) {
    const id = payslipId(payroll.id, employeeId, payroll.month)
    const existing = payslips.find(id)
    if (existing && (existing.status === 'released' || existing.status === 'released-fs')) continue
    const result = computePayslip(payroll, employeeId, payroll.month, snap, existing)
    if ('error' in result) {
      errors.push(result.error)
      continue
    }
    upsert(result.payslip)
  }
  return errors
}

/**
 * Work the open pay slips of these people for a month out again (after a
 * change that feeds them, such as a leave encashment). Released slips stay.
 */
export function refreshPayslips(employeeIds: readonly string[], month: string): void {
  const people = new Set(employeeIds)
  const snap = takeSnapshot()
  for (const payroll of payrolls.all()) {
    if (payroll.month !== month || payroll.status === 'closed') continue
    for (const employeeId of payroll.employeeIds) {
      if (!people.has(employeeId)) continue
      const existing = payslips.find(payslipId(payroll.id, employeeId, month))
      if (!existing || existing.status === 'released' || existing.status === 'released-fs') continue
      const result = computePayslip(payroll, employeeId, month, snap, existing)
      if ('payslip' in result) upsert(result.payslip)
    }
  }
}

/** A final settlement's pay slip: the month of the last working day, paid up to it. */
export function settlementPayslip(employeeId: string, lastWorkingDate: string, previous?: Payslip) {
  const month = lastWorkingDate.slice(0, 7)
  const payroll: PayrollLike = {
    id: 'fs',
    payItems: [...STANDARD_PAY_ITEMS, 'pi_leave_encashment', 'pi_gratuity'].map((payItemId) => ({
      payItemId,
      taxable: payItemId === 'pi_gross_salary',
      arrearApplicable: false,
      finalSettlement: true,
      calculateOnly: false,
    })),
    applicableDays: 'actual',
    fixedDays: null,
    taxApplicable: true,
    taxStructureId: 'ts_current',
  }
  return computePayslip(payroll, employeeId, month, takeSnapshot(), previous, lastWorkingDate)
}

// --- the seeded runs, worked out on first use ------------------------------------------------

let seeded = false
onPayrollReset(() => {
  seeded = false
})

export function ensurePayrollRuns(): void {
  if (seeded) return
  seeded = true
  if (payslips.all().length > 0) return
  const snap = takeSnapshot()
  for (const payroll of payrolls.all()) {
    const months = payroll.id === 'pr_6' ? [lastMonth(), thisMonth()] : [payroll.month]
    const errors: PayrollError[] = []
    for (const month of months) {
      const closed = payroll.id === 'pr_7' || month !== payroll.month
      for (const employeeId of payroll.employeeIds) {
        const result = computePayslip(payroll, employeeId, month, snap)
        if ('error' in result) {
          errors.push(result.error)
          continue
        }
        const onHold = payroll.id === 'pr_6' && employeeId === 'em_laiba' && !closed
        upsert({ ...result.payslip, status: closed ? 'released' : onHold ? 'on-hold' : 'ready' })
      }
    }
    // The design's sample error, on the payroll that is on hold.
    if (payroll.id === 'pr_8') {
      errors.push({
        employeeId: 'em_sara',
        employeeName: 'Sara Khan',
        message: 'Unsupported Operand Types String * Float',
      })
    }
    if (errors.length > 0) payrolls.update(payroll.id, { ...payroll, errors })
  }
}

// --- daily wages -----------------------------------------------------------------------------

export function dailyWageRows(
  batch: DailyWageBatch,
  snap: Snapshot = takeSnapshot(),
): DailyWageRow[] {
  const slot = timeSlots().find((item) => item.id === batch.timeSlotId)
  const expected = slot ? slotMinutes(slot) : 480
  return batch.employeeIds.map((employeeId) => {
    const day = computeDay(snap, employeeId, batch.date).day
    const override = batch.overrides[employeeId]
    const wage = override?.wage ?? Math.round(salaryOn(employeeId, batch.date) / 30)
    const worked = day.workedMinutes
    const present = day.checkIn !== null
    const earnings = override?.totalEarnings ?? (present ? wage : 0)
    const short = present && worked !== null ? Math.max(0, expected - worked) / expected : 0
    const deductions = override?.totalDeductions ?? Math.round(earnings * Math.min(1, short))
    return {
      employee: employeeRef(employeeId),
      checkIn: day.checkIn,
      checkOut: day.checkOut,
      wage,
      workedMinutes: worked,
      expectedMinutes: expected,
      totalEarnings: earnings,
      totalDeductions: deductions,
      netPayable: earnings - deductions,
    }
  })
}

// --- dashboard -------------------------------------------------------------------------------

function wave(month: string, seed: number) {
  const index = Number(month.slice(5, 7)) + seed
  return 0.86 + 0.05 * Math.sin(index * 1.7) + 0.03 * Math.cos(index * 0.9)
}

/** Net pay of a month: the pay slips when there are any, otherwise an estimate from salaries. */
export function monthTotal(month: string): number {
  const slips = payslips.all().filter((slip) => slip.month === month)
  if (slips.length > 0) return slips.reduce((sum, slip) => sum + slip.netPayable, 0)
  const people = new Set(payrolls.all().flatMap((payroll) => payroll.employeeIds))
  const monthEnd = `${month}-28`
  let total = 0
  for (const id of people) total += salaryOn(id, monthEnd)
  return Math.round(total * wave(month, 0))
}

export function employeeMonthTotal(employeeId: string, month: string): number {
  const slips = payslips
    .all()
    .filter((slip) => slip.employeeId === employeeId && slip.month === month)
  if (slips.length > 0) return slips.reduce((sum, slip) => sum + slip.netPayable, 0)
  return Math.round(salaryOn(employeeId, `${month}-28`) * wave(month, employeeId.length))
}

export function lastMonths(count: number, from = new Date()): string[] {
  return Array.from({ length: count }, (_, index) =>
    format(subMonths(from, count - 1 - index), 'yyyy-MM'),
  )
}

export function expensesByMonth(months: readonly string[]): MonthAmount[] {
  return months.map((month) => ({
    month,
    amount:
      vouchers
        .all()
        .filter((voucher) => voucher.date.startsWith(month) && voucher.type !== 'salary-advance')
        .reduce((sum, voucher) => sum + voucher.amount, 0) +
      employeeVouchers
        .all()
        .filter(
          (voucher) =>
            voucher.voucherDate.startsWith(month) &&
            voucher.voucherType !== 'salary-advance' &&
            voucher.status !== 'rejected',
        )
        .reduce((sum, voucher) => sum + voucher.amount, 0),
  }))
}

export function loansByMonth(months: readonly string[]): MonthAmount[] {
  return months.map((month) => ({
    month,
    amount:
      employeeVouchers
        .all()
        .filter(
          (voucher) =>
            voucher.voucherDate.startsWith(month) && voucher.voucherType === 'salary-advance',
        )
        .reduce((sum, voucher) => sum + voucher.amount, 0) +
      accountEntries
        .all()
        .filter(
          (entry) =>
            entry.accountTypeId === 'at_loan' &&
            entry.direction === 'debit' &&
            entry.month === month,
        )
        .reduce((sum, entry) => sum + entry.amount, 0),
  }))
}

export const everyone = () => DIRECTORY.map((employee) => employee.id)
