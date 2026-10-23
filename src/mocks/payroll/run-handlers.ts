import { addMonths, format, parse } from 'date-fns'
import { http } from 'msw'
import { z } from 'zod'

import {
  type DailyWageBatch,
  type DailyWageBatchRow,
  type DailyWageDetail,
  type EmploymentRow,
  type MyAccountsSummary,
  type Payroll,
  type PayrollDashboard,
  type PayrollHistoryEntry,
  type PayrollRow,
  type Payslip,
  type PayslipDetail,
  type PayslipRow,
  type SalarySheet,
  type SalarySheetRow,
} from '@/features/payroll'

import { takeSnapshot } from '../attendance/engine'
import { findEmployee } from '../employees/seed'
import { createId, latency, requireAuth } from '../utils'
import { accountEntries, dailyWages, payrolls, payslips, taxStructures, vouchers } from './db'
import {
  dailyWageRows,
  employeeMonthTotal,
  employeeProfile,
  employeeRef,
  ensurePayrollRuns,
  expensesByMonth,
  isActive,
  lastMonths,
  loansByMonth,
  monthTotal,
  runPayroll,
  timeSlots,
  withTotals,
} from './engine'
import {
  base,
  between,
  conflict,
  day,
  invalid,
  ME,
  money,
  name,
  nextCode,
  notFound,
  now,
  numberParam,
  ok,
  page,
  param,
  readBody,
  rejected,
  searched,
} from './http'
import { thisMonth } from './seed'

const ACTOR = () => findEmployee(ME)?.name ?? 'HR'

const historyEntry = (
  action: PayrollHistoryEntry['action'],
  month: string,
): PayrollHistoryEntry => ({
  id: createId('ph'),
  action,
  month,
  performedAt: now(),
  performedBy: ACTOR(),
})

function toRow(payroll: Payroll): PayrollRow {
  return {
    ...payroll,
    taxStructureName: payroll.taxStructureId
      ? (taxStructures.find(payroll.taxStructureId)?.name ?? null)
      : null,
    employeeCount: payroll.employeeIds.length,
  }
}

const payrollSchema = z
  .object({
    name,
    currency: z.literal('PKR'),
    taxStructureId: z.string().min(1, 'Choose the tax structure').nullable(),
    taxApplicable: z.boolean(),
    processing: z.enum(['from-date', 'month-end']),
    processingDay: z
      .number()
      .int()
      .min(1, 'Choose a day from 1 to 31')
      .max(31, 'Choose a day from 1 to 31')
      .nullable(),
    applicableDays: z.enum(['actual', 'fixed']),
    fixedDays: z.number().int().min(1).max(31).nullable(),
    companyBankId: z.string().min(1).nullable(),
    description: z.string().trim().max(500),
    payItems: z
      .array(
        z.object({
          payItemId: z.string().min(1, 'Choose the pay item'),
          taxable: z.boolean(),
          arrearApplicable: z.boolean(),
          finalSettlement: z.boolean(),
          calculateOnly: z.boolean(),
        }),
      )
      .max(60),
  })
  .refine((value) => value.taxStructureId !== null, {
    message: 'Choose the tax structure',
    path: ['taxStructureId'],
  })
  .refine((value) => value.processingDay !== null, {
    message: 'Choose the payroll processing date',
    path: ['processingDay'],
  })
  .refine((value) => value.applicableDays === 'actual' || value.fixedDays !== null, {
    message: 'Enter the number of fixed days',
    path: ['fixedDays'],
  })
  .refine(
    (value) => new Set(value.payItems.map((row) => row.payItemId)).size === value.payItems.length,
    { message: 'Each pay item can be added once', path: ['payItems'] },
  )

const authed = async (request: Request) => {
  await latency()
  ensurePayrollRuns()
  return requireAuth(request)
}

// --- Payrolls → Monthly ---------------------------------------------------------------------

const monthlyHandlers = [
  http.get(base('/payrolls'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const list = searched(url, payrolls.all(), (item) => `${item.code} ${item.name}`).sort((a, b) =>
      b.code.localeCompare(a.code),
    )
    return page(url, list.map(toRow))
  }),
  http.post(base('/payrolls'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, payrollSchema)
    if (!parsed.success) return rejected(parsed.error)
    if (payrolls.all().some((item) => item.name.toLowerCase() === parsed.data.name.toLowerCase())) {
      return conflict('A payroll with this name already exists', 'DUPLICATE', {
        name: 'A payroll with this name already exists',
      })
    }
    const month = thisMonth()
    const payroll: Payroll = {
      id: createId('pr'),
      code: nextCode(
        'PR-',
        payrolls.all().map((item) => item.code),
      ),
      ...parsed.data,
      employeeIds: [],
      month,
      status: 'pending',
      lastRunAt: null,
      lastClosedAt: null,
      history: [historyEntry('Created', month)],
      errors: [],
      createdAt: now(),
    }
    payrolls.insert(payroll)
    return ok(toRow(payroll))
  }),
  http.get(base('/payrolls/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const payroll = payrolls.find(String(params.id))
    return payroll ? ok(toRow(payroll)) : notFound('payroll')
  }),
  http.put(base('/payrolls/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const payroll = payrolls.find(String(params.id))
    if (!payroll) return notFound('payroll')
    const parsed = await readBody(request, payrollSchema)
    if (!parsed.success) return rejected(parsed.error)
    const next: Payroll = {
      ...payroll,
      ...parsed.data,
      history: [historyEntry('Updated', payroll.month), ...payroll.history],
    }
    payrolls.update(payroll.id, next)
    return ok(toRow(next))
  }),
  http.post(base('/payrolls/:id/run'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const payroll = payrolls.find(String(params.id))
    if (!payroll) return notFound('payroll')
    if (payroll.employeeIds.length === 0) {
      return invalid('Add employees to the payroll before running it (View Employments → Add).')
    }
    let month = payroll.month
    // A closed month is done: the next run is the following month.
    if (payroll.status === 'closed') {
      month = format(addMonths(parse(payroll.month, 'yyyy-MM', new Date()), 1), 'yyyy-MM')
      if (month > thisMonth()) {
        return conflict(
          `${format(parse(payroll.month, 'yyyy-MM', new Date()), 'MMMM yyyy')} is closed; the next month can be run once it starts.`,
        )
      }
    }
    const running: Payroll = { ...payroll, month }
    const errors = runPayroll(running)
    const next: Payroll = {
      ...running,
      status: 'run',
      lastRunAt: now(),
      errors,
      history: [historyEntry('Run', month), ...payroll.history],
    }
    payrolls.update(payroll.id, next)
    return ok(toRow(next))
  }),
  http.post(base('/payrolls/:id/close'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const payroll = payrolls.find(String(params.id))
    if (!payroll) return notFound('payroll')
    if (payroll.status !== 'run' && payroll.status !== 'on-hold') {
      return conflict('Only a payroll that has been run can be closed.')
    }
    for (const slip of payslips.all()) {
      if (
        slip.payrollId === payroll.id &&
        slip.month === payroll.month &&
        slip.status === 'ready'
      ) {
        payslips.update(slip.id, { ...slip, status: 'released' })
      }
    }
    const next: Payroll = {
      ...payroll,
      status: 'closed',
      lastClosedAt: now(),
      history: [historyEntry('Closed', payroll.month), ...payroll.history],
    }
    payrolls.update(payroll.id, next)
    return ok(toRow(next))
  }),
  http.post(base('/payrolls/hold'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(
      request,
      z.object({ ids: z.array(z.string()).min(1, 'Select a payroll') }),
    )
    if (!parsed.success) return rejected(parsed.error)
    let held = 0
    for (const id of parsed.data.ids) {
      const payroll = payrolls.find(id)
      if (!payroll || payroll.status === 'closed' || payroll.status === 'on-hold') continue
      payrolls.update(id, {
        ...payroll,
        status: 'on-hold',
        history: [historyEntry('On Hold', payroll.month), ...payroll.history],
      })
      held += 1
    }
    return ok({ held })
  }),
  http.get(base('/payrolls/:id/employments'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const payroll = payrolls.find(String(params.id))
    if (!payroll) return notFound('payroll')
    const url = new URL(request.url)
    const rows: EmploymentRow[] = payroll.employeeIds.map((id) => {
      const profile = employeeProfile(id)
      return { employee: employeeRef(id), joiningDate: profile.joiningDate, branch: profile.branch }
    })
    return ok(
      searched(
        url,
        rows,
        (row) => `${row.employee.name} ${row.employee.code} ${row.employee.designation}`,
      ),
    )
  }),
  http.put(base('/payrolls/:id/employments'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const payroll = payrolls.find(String(params.id))
    if (!payroll) return notFound('payroll')
    const parsed = await readBody(
      request,
      z.object({ employeeIds: z.array(z.string().min(1)).max(500) }),
    )
    if (!parsed.success) return rejected(parsed.error)
    // One payroll per person.
    const elsewhere = parsed.data.employeeIds.find((id) =>
      payrolls.all().some((item) => item.id !== payroll.id && item.employeeIds.includes(id)),
    )
    if (elsewhere) {
      const other = payrolls
        .all()
        .find((item) => item.id !== payroll.id && item.employeeIds.includes(elsewhere))
      return conflict(
        `${employeeRef(elsewhere).name} is already on ${other?.name ?? 'another payroll'}.`,
      )
    }
    const next = { ...payroll, employeeIds: [...new Set(parsed.data.employeeIds)] }
    payrolls.update(payroll.id, next)
    return ok(toRow(next))
  }),
  http.get(base('/payrolls/:id/history'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const payroll = payrolls.find(String(params.id))
    return payroll ? ok(payroll.history) : notFound('payroll')
  }),
  http.get(base('/payrolls/:id/errors'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const payroll = payrolls.find(String(params.id))
    return payroll ? ok(payroll.errors) : notFound('payroll')
  }),
]

// --- Salary Sheet --------------------------------------------------------------------------------

const amountOf = (slip: Payslip, ids: readonly string[]) =>
  slip.items
    .filter((item) => ids.includes(item.payItemId))
    .reduce((sum, item) => sum + item.value, 0)

const salarySheetHandlers = [
  http.get(base('/salary-sheet'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const payroll =
      payrolls.find(param(url, 'payrollId') ?? '') ??
      payrolls.all().find((item) => item.status === 'run') ??
      payrolls.all()[0]
    if (!payroll) return ok<SalarySheet>({ payroll: null, rows: [], total: emptyTotal() })
    const month = param(url, 'month') ?? payroll.month
    const rows: SalarySheetRow[] = payslips
      .all()
      .filter((slip) => slip.payrollId === payroll.id && slip.month === month)
      .map((slip): SalarySheetRow => ({
        employee: employeeRef(slip.employeeId),
        paymentMethod: payroll.companyBankId ? 'Bank Transfer' : 'Cash',
        grossSalary: amountOf(slip, ['pi_gross_salary']),
        overtime: amountOf(slip, ['pi_overtime', 'pi_over_time']),
        tax: amountOf(slip, ['pi_tax']),
        leaveDeduction: amountOf(slip, ['pi_leave_deduction']),
        shortDeduction: amountOf(slip, ['pi_short_duration']),
        absentDeduction: amountOf(slip, ['pi_absent']),
        totalEarnings: slip.earnings,
        totalDeductions: slip.deductions,
        totalReimbursements: slip.reimbursements,
        netPay: slip.netPayable,
      }))
      .sort((a, b) => a.employee.name.localeCompare(b.employee.name))
    const total = rows.reduce((sum, row) => {
      const next = { ...sum }
      for (const field of Object.keys(sum) as (keyof typeof sum)[])
        next[field] = sum[field] + row[field]
      return next
    }, emptyTotal())
    return ok<SalarySheet>({ payroll: { id: payroll.id, name: payroll.name, month }, rows, total })
  }),
]

function emptyTotal(): SalarySheet['total'] {
  return {
    grossSalary: 0,
    overtime: 0,
    tax: 0,
    leaveDeduction: 0,
    shortDeduction: 0,
    absentDeduction: 0,
    totalEarnings: 0,
    totalDeductions: 0,
    totalReimbursements: 0,
    netPay: 0,
  }
}

// --- Pay Slips -------------------------------------------------------------------------------------

function payslipRow(slip: Payslip): PayslipRow {
  const payroll = payrolls.find(slip.payrollId)
  return {
    id: slip.id,
    employee: employeeRef(slip.employeeId),
    month: slip.month,
    // The run's day for the month being run; earlier months were run on the 28th.
    date:
      payroll?.lastRunAt && payroll.month === slip.month
        ? payroll.lastRunAt.slice(0, 10)
        : `${slip.month}-28`,
    payrollId: slip.payrollId,
    payrollName: payroll?.name ?? 'Final Settlement',
    earnings: slip.earnings,
    deductions: slip.deductions,
    reimbursements: slip.reimbursements,
    netPayable: slip.netPayable,
    status: slip.status,
  }
}

export function payslipDetail(slip: Payslip): PayslipDetail {
  return {
    ...slip,
    employee: employeeProfile(slip.employeeId),
    payrollName: payrolls.find(slip.payrollId)?.name ?? 'Final Settlement',
  }
}

function filterPayslips(url: URL, list: readonly Payslip[]): Payslip[] {
  const branchId = param(url, 'branchId')
  const department = param(url, 'department')
  const employeeId = param(url, 'employeeId')
  const employmentStatus = param(url, 'employmentStatus')
  const status = param(url, 'status')
  const payrollId = param(url, 'payrollId')
  const month = param(url, 'month')
  return list.filter((slip) => {
    const employee = findEmployee(slip.employeeId)
    if (branchId && employee?.branchId !== branchId) return false
    if (department && employee?.department !== department) return false
    if (employeeId && slip.employeeId !== employeeId) return false
    if (employmentStatus === 'active' && !isActive(slip.employeeId)) return false
    if (employmentStatus === 'inactive' && isActive(slip.employeeId)) return false
    if (status && slip.status !== status) return false
    if (payrollId && slip.payrollId !== payrollId) return false
    if (month && slip.month !== month) return false
    return (
      between(slip.earnings, numberParam(url, 'earningsFrom'), numberParam(url, 'earningsTo')) &&
      between(
        slip.deductions,
        numberParam(url, 'deductionFrom'),
        numberParam(url, 'deductionTo'),
      ) &&
      between(slip.netPayable, numberParam(url, 'netFrom'), numberParam(url, 'netTo'))
    )
  })
}

function changeSlipStatus(slip: Payslip, status: Payslip['status']): Payslip {
  const next = { ...slip, status }
  payslips.update(slip.id, next)
  return next
}

const payslipItemsSchema = z.object({
  items: z
    .array(
      z.object({
        payItemId: z.string().min(1),
        value: money,
        employeeContribution: money.nullable(),
        employerContribution: money.nullable(),
        manuallyUpdated: z.boolean(),
      }),
    )
    .min(1),
})

const slipAction = (
  path: string,
  allowed: readonly Payslip['status'][],
  apply: (slip: Payslip) => Payslip | Response,
) =>
  http.post(base(`/payslips/:id/${path}`), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const slip = payslips.find(String(params.id))
    if (!slip) return notFound('pay slip')
    if (!allowed.includes(slip.status))
      return conflict('This pay slip cannot do that in its current status.')
    const result = apply(slip)
    return result instanceof Response ? result : ok(payslipDetail(result))
  })

const payslipHandlers = [
  http.get(base('/payslips'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const mine = param(url, 'scope') === 'my'
    const list = filterPayslips(
      url,
      payslips.all().filter((slip) => (mine ? slip.employeeId === ME : slip.payrollId !== 'fs')),
    ).sort(
      (a, b) =>
        b.month.localeCompare(a.month) ||
        employeeRef(a.employeeId).name.localeCompare(employeeRef(b.employeeId).name),
    )
    return page(url, list.map(payslipRow))
  }),
  http.get(base('/payslips/summary'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const mine = accountEntries.all().filter((entry) => entry.employeeId === ME)
    const balance = (accountTypeId: string) =>
      mine
        .filter((entry) => entry.accountTypeId === accountTypeId)
        .reduce(
          (sum, entry) => sum + (entry.direction === 'credit' ? entry.amount : -entry.amount),
          0,
        )
    const summary: MyAccountsSummary = {
      providentFund: balance('at_pf'),
      eobi: balance('at_eobi'),
      outstandingLoan: Math.max(0, -balance('at_loan')),
    }
    return ok(summary)
  }),
  http.post(base('/payslips/hold'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(
      request,
      z.object({ ids: z.array(z.string()).min(1, 'Select a pay slip') }),
    )
    if (!parsed.success) return rejected(parsed.error)
    let held = 0
    for (const id of parsed.data.ids) {
      const slip = payslips.find(id)
      if (slip?.status !== 'ready') continue
      changeSlipStatus(slip, 'on-hold')
      held += 1
    }
    return ok({ held })
  }),
  http.get(base('/payslips/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const slip = payslips.find(String(params.id))
    return slip ? ok(payslipDetail(slip)) : notFound('pay slip')
  }),
  http.put(base('/payslips/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const slip = payslips.find(String(params.id))
    if (!slip) return notFound('pay slip')
    if (slip.status !== 'ready' && slip.status !== 'on-hold') {
      return conflict('A released pay slip cannot be edited.')
    }
    const parsed = await readBody(request, payslipItemsSchema)
    if (!parsed.success) return rejected(parsed.error)
    const changes = [...slip.changes]
    const items = slip.items.map((item) => {
      const input = parsed.data.items.find((entry) => entry.payItemId === item.payItemId)
      if (!input) return item
      if (input.value !== item.value) {
        changes.unshift({
          id: createId('chg'),
          field: item.name,
          oldValue: String(item.value),
          newValue: String(input.value),
          action: 'Update',
          performedAt: now(),
          performedBy: ACTOR(),
        })
      }
      const edited = input.value !== item.value || input.manuallyUpdated
      return {
        ...item,
        value: input.value,
        employeeContribution: input.employeeContribution ?? item.employeeContribution,
        employerContribution: input.employerContribution ?? item.employerContribution,
        manuallyUpdated: edited,
      }
    })
    const next = withTotals({ ...slip, items, changes })
    payslips.update(slip.id, next)
    return ok(payslipDetail(next))
  }),
  slipAction('hold', ['ready'], (slip) => changeSlipStatus(slip, 'on-hold')),
  slipAction('pay', ['on-hold'], (slip) => changeSlipStatus(slip, 'released')),
  slipAction('recalculate', ['ready', 'on-hold'], (slip) => {
    const payroll = payrolls.find(slip.payrollId)
    if (!payroll) return notFound('payroll')
    runPayroll({ ...payroll, employeeIds: [slip.employeeId], month: slip.month }, takeSnapshot())
    return payslips.find(slip.id) ?? slip
  }),
]

// --- Payrolls → Daily Wages ------------------------------------------------------------------------

function dailyRow(batch: DailyWageBatch): DailyWageBatchRow {
  const slot = timeSlots().find((item) => item.id === batch.timeSlotId) ?? {
    id: batch.timeSlotId,
    code: 'TS-00000',
    name: 'Default time slot',
    clockIn: '10:00',
    clockOut: '17:00',
  }
  const rows = dailyWageRows(batch)
  return {
    id: batch.id,
    code: batch.code,
    name: batch.name,
    date: batch.date,
    timeSlot: slot,
    createdBy: employeeRef(batch.employeeIds[0] ?? ME),
    totalEmployees: batch.employeeIds.length,
    netPayable: rows.reduce((sum, row) => sum + row.netPayable, 0),
    status: batch.status,
  }
}

const dailyWageSchema = z.object({
  name,
  date: day,
  timeSlotId: z.string().min(1, 'Choose the time slot'),
  employeeIds: z.array(z.string().min(1)).min(1, 'Select at least one employee').max(500),
})

const dailyWageHandlers = [
  http.get(base('/daily-wages'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const slot = param(url, 'timeSlotId')
    const text = (param(url, 'name') ?? '').toLowerCase()
    const from = param(url, 'from')
    const to = param(url, 'to')
    const list = dailyWages
      .all()
      .filter(
        (batch) =>
          (!slot || batch.timeSlotId === slot) &&
          (!text || batch.name.toLowerCase().includes(text)) &&
          (!from || batch.date >= from) &&
          (!to || batch.date <= to),
      )
      .sort((a, b) => b.date.localeCompare(a.date))
    return page(url, list.map(dailyRow))
  }),
  http.post(base('/daily-wages'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, dailyWageSchema)
    if (!parsed.success) return rejected(parsed.error)
    if (parsed.data.date > format(new Date(), 'yyyy-MM-dd')) {
      return invalid('Daily wages are paid for today or an earlier day', {
        date: 'Choose today or an earlier day',
      })
    }
    const batch = {
      id: createId('dw'),
      code: nextCode(
        'DW-',
        dailyWages.all().map((item) => item.code),
      ),
      ...parsed.data,
      overrides: {},
      status: 'closed' as const,
      createdAt: now(),
    }
    dailyWages.insert(batch)
    return ok(dailyRow(batch))
  }),
  http.get(base('/daily-wages/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const batch = dailyWages.find(String(params.id))
    if (!batch) return notFound('daily wage payroll')
    const detail: DailyWageDetail = { ...dailyRow(batch), rows: dailyWageRows(batch) }
    return ok(detail)
  }),
  http.put(base('/daily-wages/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const batch = dailyWages.find(String(params.id))
    if (!batch) return notFound('daily wage payroll')
    const parsed = await readBody(
      request,
      z.object({
        name,
        rows: z
          .array(
            z.object({
              employeeId: z.string().min(1),
              totalEarnings: money,
              totalDeductions: money,
              wage: money,
            }),
          )
          .max(500),
      }),
    )
    if (!parsed.success) return rejected(parsed.error)
    const bad = parsed.data.rows.find((row) => row.totalDeductions > row.totalEarnings)
    if (bad) {
      return invalid(
        `${employeeRef(bad.employeeId).name}: deductions cannot be more than the earnings.`,
      )
    }
    const overrides = { ...batch.overrides }
    for (const row of parsed.data.rows) {
      overrides[row.employeeId] = {
        totalEarnings: row.totalEarnings,
        totalDeductions: row.totalDeductions,
        wage: row.wage,
      }
    }
    const next = { ...batch, name: parsed.data.name, overrides }
    dailyWages.update(batch.id, next)
    return ok<DailyWageDetail>({ ...dailyRow(next), rows: dailyWageRows(next) })
  }),
  http.post(base('/daily-wages/:id/vouchers'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const batch = dailyWages.find(String(params.id))
    if (!batch) return notFound('daily wage payroll')
    let created = 0
    for (const row of dailyWageRows(batch)) {
      if (row.netPayable <= 0) continue
      const id = `vc_${batch.id}_${row.employee.id}`
      const existing = vouchers.find(id)
      const code = existing?.code ?? String(1100 + vouchers.all().length * 7)
      const voucher = {
        id,
        code,
        employeeId: row.employee.id,
        amount: row.netPayable,
        date: batch.date,
        type: 'daily-wages' as const,
      }
      if (existing) vouchers.update(id, voucher)
      else vouchers.insert(voucher)
      created += 1
    }
    return ok({ created })
  }),
]

// --- Dashboard -----------------------------------------------------------------------------------------

const dashboardHandlers = [
  http.get(base('/dashboard'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const year = new Date().getFullYear()
    const monthsOf = (y: number) =>
      Array.from({ length: 12 }, (_, index) => `${y}-${String(index + 1).padStart(2, '0')}`)
    const current = thisMonth()
    const dashboard: PayrollDashboard = {
      yearly: [year - 1, year].map((y) => ({
        year: y,
        months: monthsOf(y).map((month) => ({
          month,
          amount: month > current ? 0 : monthTotal(month),
        })),
      })),
      expensesMonthWise: expensesByMonth(lastMonths(6)),
      loanAndAdvance: loansByMonth(lastMonths(6)),
    }
    return ok(dashboard)
  }),
  http.get(base('/dashboard/employees/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const id = String(params.id)
    if (!findEmployee(id)) return notFound('employee')
    return ok(lastMonths(6).map((month) => ({ month, amount: employeeMonthTotal(id, month) })))
  }),
]

export const payrollRunHandlers = [
  ...monthlyHandlers,
  ...salarySheetHandlers,
  ...payslipHandlers,
  ...dailyWageHandlers,
  ...dashboardHandlers,
]
