import { format } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import type {
  AccountBalance,
  DailyWageDetail,
  DailyWageRow,
  EmployeeAccountReportRow,
  PayrollDashboard,
  PayrollEmployeeRow,
  PayrollError,
  PayrollRow,
  PayrollSummary,
  PayslipDetail,
  PayslipHistoryEntry,
  PayslipRow,
  RunLog,
  SalarySheet,
  SalarySheetRow,
  VoucherRow,
} from '@/features/payroll'

import { DIRECTORY, findEmployee } from '../employees/seed'
import { latency, requireAuth } from '../utils'
import {
  accountEntries,
  banks,
  onPayrollReset,
  payItems,
  payrolls,
  payslips,
  type StoredPayroll,
  type StoredPayslip,
  taxRebates,
  taxStructures,
  vouchers,
} from './db'
import {
  computePayslip,
  dailyWageSlip,
  dayWage,
  defaultPayItemRows,
  payslipIdOf,
  slotMinutes,
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
  nextCode,
  notFound,
  numberParam,
  ok,
  page,
  param,
  readBody,
  rejected,
  searched,
} from './http'
import { departmentId } from './lookup-handlers'
import { isActive, nextRowVersion, personFields } from './people'

// Monthly and daily-wage payrolls, the salary sheet, payslips, reports and the dashboard, as
// `backend/app/routers/payroll_runs.py` and `payroll_reports.py` serve them.

type Guarded = (args: {
  request: Request
  params: Record<string, string | readonly string[] | undefined>
}) => Promise<Response>

/** Auth, latency and the seeded payslips, then the handler. */
const guarded =
  (handler: Guarded): Guarded =>
  async (args) => {
    await latency()
    const denied = requireAuth(args.request)
    if (denied) return denied
    ensureRunsSeeded()
    return handler(args)
  }

const now = () => new Date().toISOString().slice(0, 19)
const id = (value: string | readonly string[] | undefined) => String(value ?? '')

// --- seeding -------------------------------------------------------------------------------

let seeded = false
onPayrollReset(() => {
  seeded = false
})

/** Works out the seeded runs' payslips once (monthly: Salary + Tax; daily wages: the day's wage). */
function ensureRunsSeeded() {
  if (seeded) return
  seeded = true
  for (const payroll of payrolls.all()) {
    const has = payslips.all().some((slip) => slip.payrollId === payroll.id)
    if (has || payroll.status === 'open') continue
    if (payroll.kind === 'daily_wage') {
      processDailyWage(payroll)
      if (payroll.status === 'closed') closeRun(payrolls.find(payroll.id) ?? payroll)
      continue
    }
    for (const employeeId of payroll.employeeIds) {
      const slip = computePayslip(payroll, employeeId)
      payslips.insert({
        ...slip,
        status:
          payroll.status === 'closed'
            ? 'released'
            : payroll.status === 'on_hold'
              ? 'on_hold'
              : 'ready',
        releasedAt: payroll.status === 'closed' ? payroll.closedAt : null,
      })
    }
    refresh(payroll.id)
  }
}

// --- runs ------------------------------------------------------------------------------------

/** The run's counts and totals from its payslips. */
function refresh(payrollId: string): StoredPayroll | undefined {
  const payroll = payrolls.find(payrollId)
  if (!payroll) return undefined
  const slips = payslips.all().filter((slip) => slip.payrollId === payrollId)
  const sum = (pick: (slip: StoredPayslip) => number | null) =>
    Math.round(slips.reduce((total, slip) => total + (pick(slip) ?? 0), 0) * 100) / 100
  const next = {
    ...payroll,
    employeeCount: payroll.employeeIds.length,
    payslipCount: slips.length,
    totalEarnings: sum((slip) => slip.totalEarnings),
    totalDeductions: sum((slip) => slip.totalDeductions),
    netPayable: sum((slip) => slip.netPayable),
  }
  payrolls.update(payrollId, next)
  return next
}

function rowOf(payroll: StoredPayroll): PayrollRow {
  const { employeeIds: _people, history: _history, rows: _rows, errors: _errors, ...row } = payroll
  return row
}

function detailOf(payroll: StoredPayroll): DailyWageDetail {
  return { ...rowOf(payroll), rows: payroll.rows ?? [] }
}

const findRun = (value: string | readonly string[] | undefined, kind: StoredPayroll['kind']) => {
  const payroll = payrolls.find(id(value))
  return payroll?.kind === kind ? payroll : undefined
}

const closedRun = () =>
  conflict('This payroll is closed. It cannot be changed', 'PAYROLL_CLOSED', {
    status: 'This payroll is closed.',
  })
const staleRun = () => conflict('Someone else changed this payroll. Reload it and try again')

function addLog(payroll: StoredPayroll, kind: string, processed: number, errors: number): RunLog {
  const entry: RunLog = {
    id: `${payroll.id}_${kind}_${payroll.history.length + 1}`,
    kind,
    startedAt: now(),
    finishedAt: now(),
    status: 'completed',
    processedCount: processed,
    errorCount: errors,
    runByUserId: 'u_shelley',
    runByName: 'Shelley Kannes',
  }
  payrolls.update(payroll.id, { ...payroll, history: [...payroll.history, entry] })
  return entry
}

/** Releases ready slips and closes the run. */
function closeRun(payroll: StoredPayroll) {
  const stamp = now()
  for (const slip of payslips.all().filter((item) => item.payrollId === payroll.id)) {
    payslips.update(slip.id, {
      ...slip,
      payrollStatus: 'closed',
      status: slip.status === 'ready' ? 'released' : slip.status,
      releasedAt: slip.status === 'ready' ? stamp : slip.releasedAt,
      rowVersion: nextRowVersion(),
    })
  }
  const closed = {
    ...payroll,
    status: 'closed' as const,
    closedAt: stamp,
    closedByUserId: 'u_shelley',
    rowVersion: nextRowVersion(),
    rows: payroll.rows?.map((row) => ({
      ...row,
      payslipStatus: row.payslipStatus === 'ready' ? ('released' as const) : row.payslipStatus,
    })),
  }
  payrolls.update(payroll.id, closed)
  const after = payrolls.find(payroll.id) ?? closed
  addLog(after, 'close', payslips.all().filter((item) => item.payrollId === payroll.id).length, 0)
}

const payrollItem = z.object({
  payItemId: z.string().min(1),
  isTaxable: z.boolean().default(false),
  arrearApplicable: z.boolean().default(false),
  finalSettlement: z.boolean().default(false),
  calculateOnly: z.boolean().default(false),
})

const payrollInput = z.object({
  name: z.string().trim().min(1, 'Enter the payroll name').max(200),
  payrollMonth: day,
  currency: z.string().length(3, 'Choose the currency'),
  taxStructureId: z.string().min(1, 'Choose the tax structure'),
  taxApplicable: z.boolean().default(true),
  processingMode: z.enum(['from_date', 'month_end']),
  processingDate: day,
  applicableDays: z.enum(['actual', 'fixed']).default('actual'),
  fixedDays: z.number().int().min(1).max(31).nullable().optional(),
  disbursementBankId: z.string().min(1, 'Choose the disbursement bank'),
  description: z.string().max(200).nullable().optional(),
  payItems: z.array(payrollItem).nullable().optional(),
  rowVersion: z.string().nullable().optional(),
})

function payItemRows(input: z.infer<typeof payrollInput>['payItems']) {
  const all = defaultPayItemRows(payItems.all())
  if (!input) return all
  return input.map((row) => {
    const known = all.find((item) => item.payItemId === row.payItemId)
    return {
      payItemId: row.payItemId,
      payItemName: known?.payItemName ?? row.payItemId,
      itemType: known?.itemType ?? 'earning',
      systemCode: known?.systemCode ?? null,
      isTaxable: row.isTaxable,
      arrearApplicable: row.arrearApplicable,
      finalSettlement: row.finalSettlement,
      calculateOnly: row.calculateOnly,
    }
  })
}

function employeeRow(payrollId: string, employeeId: string): PayrollEmployeeRow {
  const person = personFields(employeeId)
  const slip = payslips.find(payslipIdOf(payrollId, employeeId))
  return {
    employeeId,
    employeeCode: person.employeeCode,
    employeeName: person.employeeName,
    designationName: person.designationName,
    departmentName: person.departmentName,
    branchName: person.branchName,
    employeeStatus: isActive(employeeId) ? 'active' : 'inactive',
    joiningDate: person.joiningDate,
    payslipId: slip?.id ?? null,
    payslipStatus: slip?.status ?? null,
    netPayable: slip?.netPayable ?? null,
  }
}

/** Runs (or reruns) a monthly payroll: released slips stay, the rest are worked out again. */
function runMonthly(payroll: StoredPayroll): RunLog {
  const errors: PayrollError[] = []
  const logId = `${payroll.id}_run_${payroll.history.length + 1}`
  let processed = 0
  const keep = new Set(payroll.employeeIds)
  for (const slip of payslips.all().filter((item) => item.payrollId === payroll.id)) {
    if (!keep.has(slip.employeeId) && slip.status !== 'released') payslips.remove(slip.id)
  }
  for (const employeeId of payroll.employeeIds) {
    const previous = payslips.find(payslipIdOf(payroll.id, employeeId))
    if (previous?.status === 'released') continue
    if (!isActive(employeeId)) {
      const person = personFields(employeeId)
      errors.push({
        id: `${logId}_${employeeId}`,
        payrollRunLogId: logId,
        employeeId,
        employeeCode: person.employeeCode,
        employeeName: person.employeeName,
        message: 'The employee is not active in the payroll month.',
        startedAt: now(),
      })
      continue
    }
    const slip = computePayslip({ ...payroll, status: 'running' }, employeeId, previous)
    if (previous) payslips.update(slip.id, slip)
    else payslips.insert(slip)
    processed += 1
  }
  payrolls.update(payroll.id, {
    ...payroll,
    status: payroll.status === 'open' ? 'running' : payroll.status,
    lastRunAt: now(),
    rowVersion: nextRowVersion(),
    errors: [...(payroll.errors ?? []), ...errors],
  })
  refresh(payroll.id)
  const after = payrolls.find(payroll.id) ?? payroll
  const entry = addLog(after, 'run', processed, errors.length)
  return { ...entry, id: logId, runByUserId: null, runByName: null }
}

// --- daily wages ----------------------------------------------------------------------------

/** Works out the day's wage for everyone on the run and writes their wage slips. */
function processDailyWage(payroll: StoredPayroll) {
  const slot = timeSlots().find((item) => item.id === payroll.timeSlotId)
  const expected = slot ? slotMinutes(slot) : 480
  const workDate = payroll.workDate ?? format(new Date(), 'yyyy-MM-dd')
  const rows: DailyWageRow[] = []
  for (const employeeId of payroll.employeeIds) {
    const person = personFields(employeeId)
    const previous = payroll.rows?.find((row) => row.employeeId === employeeId)
    const existing = payslips.find(payslipIdOf(payroll.id, employeeId))
    if (existing?.status === 'released' && previous) {
      rows.push(previous)
      continue
    }
    const wage = dayWage(employeeId, workDate)
    const slip = dailyWageSlip({ ...payroll, status: 'running' }, employeeId, wage)
    if (existing) payslips.update(slip.id, slip)
    else payslips.insert(slip)
    rows.push({
      employeeId,
      employeeCode: person.employeeCode,
      employeeName: person.employeeName,
      checkIn: `${workDate}T${slot?.startTime ?? '09:00:00'}`,
      checkOut: `${workDate}T${slot?.endTime ?? '17:00:00'}`,
      expectedMinutes: expected,
      workedMinutes: expected,
      payslipId: slip.id,
      wage,
      totalEarnings: slip.totalEarnings,
      totalDeductions: slip.totalDeductions,
      netPayable: slip.netPayable,
      payslipStatus: slip.status,
      paymentMethod: slip.paymentMethod,
      isManuallyUpdated: false,
      voucherId: previous?.voucherId ?? null,
      voucherNo: previous?.voucherNo ?? null,
      voucherStatus: previous?.voucherStatus ?? null,
    })
  }
  payrolls.update(payroll.id, {
    ...payroll,
    rows,
    status: payroll.status === 'open' ? 'running' : payroll.status,
    lastRunAt: now(),
    rowVersion: nextRowVersion(),
  })
  refresh(payroll.id)
  return addLog(payrolls.find(payroll.id) ?? payroll, 'process', rows.length, 0)
}

/** Rows for people added but not processed yet. */
function withPendingRows(payroll: StoredPayroll): StoredPayroll {
  const rows = (payroll.rows ?? []).filter((row) => payroll.employeeIds.includes(row.employeeId))
  for (const employeeId of payroll.employeeIds) {
    if (rows.some((row) => row.employeeId === employeeId)) continue
    const person = personFields(employeeId)
    rows.push({
      employeeId,
      employeeCode: person.employeeCode,
      employeeName: person.employeeName,
      checkIn: null,
      checkOut: null,
      expectedMinutes: null,
      workedMinutes: null,
      payslipId: null,
      wage: null,
      totalEarnings: null,
      totalDeductions: null,
      netPayable: null,
      payslipStatus: null,
      paymentMethod: null,
      isManuallyUpdated: null,
      voucherId: null,
      voucherNo: null,
      voucherStatus: null,
    })
  }
  return { ...payroll, rows }
}

const dailyWageInput = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(200),
  workDate: day,
  timeSlotId: z.string().min(1, 'Choose the time slot'),
  employeeIds: z.array(z.string()).default([]),
})

const dailyWageEdit = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(200),
  rows: z
    .array(
      z.object({
        employeeId: z.string(),
        totalEarnings: z.number().min(0),
        totalDeductions: z.number().min(0).default(0),
      }),
    )
    .default([]),
  rowVersion: z.string(),
})

// --- payslips --------------------------------------------------------------------------------

function listRow(slip: StoredPayslip): PayslipRow {
  const {
    history: _history,
    lines: _lines,
    display: _display,
    designationName: _designation,
    jobTitleName: _jobTitle,
    locationName: _location,
    joiningDate: _joining,
    bankName: _bank,
    accountNumber: _account,
    currency: _currency,
    applicableDays: _applicable,
    workedDays: _worked,
    workedMinutes: _workedMinutes,
    expectedMinutes: _expected,
    leaveDays: _leave,
    absentDays: _absent,
    overtimeMinutes: _overtime,
    taxableIncome: _taxable,
    isManuallyUpdated: _manual,
    ...row
  } = slip
  return row
}

function detail(slip: StoredPayslip): PayslipDetail {
  const { history: _history, ...rest } = slip
  return rest
}

function slipAction(slip: StoredPayslip, action: string): StoredPayslip | string {
  const run = slip.payrollId ? payrolls.find(slip.payrollId) : undefined
  const runClosed = run?.status === 'closed'
  const stamp = now()
  switch (action) {
    case 'hold':
      if (slip.status !== 'ready') return 'Only a payslip that is ready can be put on hold.'
      return { ...slip, status: 'on_hold' }
    case 'unhold':
      if (slip.status !== 'on_hold') return 'This payslip is not on hold.'
      return runClosed
        ? { ...slip, status: 'released', releasedAt: slip.releasedAt ?? stamp }
        : { ...slip, status: 'ready' }
    case 'pay':
      if (slip.status === 'on_hold')
        return 'A payslip on hold cannot be paid. Release the hold first.'
      if (slip.paidAt) return 'This payslip is already paid.'
      return { ...slip, status: 'released', releasedAt: slip.releasedAt ?? stamp, paidAt: stamp }
    case 'recalculate':
      if (runClosed || slip.status === 'released')
        return 'This payslip is released or its payroll is closed. It cannot be changed'
      if (!run) return 'This payslip has no payroll to recalculate from.'
      return run.kind === 'daily_wage'
        ? slip
        : { ...computePayslip(run, slip.employeeId, slip), status: slip.status }
    default:
      return 'Unknown action.'
  }
}

function logChange(
  slip: StoredPayslip,
  entry: Omit<PayslipHistoryEntry, 'id' | 'performedAt' | 'performedByUserId' | 'performedByName'>,
): StoredPayslip {
  const history = slip.history ?? []
  return {
    ...slip,
    history: [
      ...history,
      {
        ...entry,
        id: `${slip.id}_h${history.length + 1}`,
        performedAt: now(),
        performedByUserId: 'u_shelley',
        performedByName: 'Shelley Kannes',
      },
    ],
  }
}

function applyAction(slip: StoredPayslip, action: string): StoredPayslip | string {
  const next = slipAction(slip, action)
  if (typeof next === 'string') return next
  const saved = logChange(
    { ...next, updatedAt: now(), rowVersion: nextRowVersion() },
    { fieldName: 'status', oldValue: slip.status, newValue: next.status, actionName: action },
  )
  payslips.update(slip.id, saved)
  if (slip.payrollId) refresh(slip.payrollId)
  return saved
}

const payslipEdit = z.object({
  lines: z
    .array(
      z.object({
        payItemId: z.string(),
        amount: z.number(),
        employerContribution: z.number().nullable().optional(),
      }),
    )
    .min(1, 'Change at least one line'),
  rowVersion: z.string(),
})

function visibleSlips(url: URL): StoredPayslip[] {
  const scope = param(url, 'scope') ?? 'all'
  const branch = param(url, 'branchId')
  const department = param(url, 'departmentId')
  const status = param(url, 'employmentStatus')
  const fs = param(url, 'finalSettlement')
  const earningsFrom = numberParam(url, 'earningsFrom')
  const earningsTo = numberParam(url, 'earningsTo')
  const deductionFrom = numberParam(url, 'deductionFrom')
  const deductionTo = numberParam(url, 'deductionTo')
  const netFrom = numberParam(url, 'netFrom')
  const netTo = numberParam(url, 'netTo')
  const list = payslips.all().filter((slip) => {
    const employee = findEmployee(slip.employeeId)
    return (
      (scope !== 'my' || slip.employeeId === ME) &&
      (param(url, 'payrollId') === undefined || slip.payrollId === param(url, 'payrollId')) &&
      (param(url, 'month') === undefined || slip.payslipMonth === param(url, 'month')) &&
      (param(url, 'status') === undefined || slip.status === param(url, 'status')) &&
      (param(url, 'employeeId') === undefined || slip.employeeId === param(url, 'employeeId')) &&
      (branch === undefined || employee?.branchId === branch) &&
      (department === undefined ||
        (employee !== undefined && departmentId(employee.department) === department)) &&
      (status === undefined || (status === 'active') === isActive(slip.employeeId)) &&
      (fs === undefined || String(slip.isFinalSettlement) === fs) &&
      between(slip.totalEarnings ?? 0, earningsFrom, earningsTo) &&
      between(slip.totalDeductions ?? 0, deductionFrom, deductionTo) &&
      between(slip.netPayable ?? 0, netFrom, netTo)
    )
  })
  return searched(url, list, (slip) => `${slip.employeeName} ${slip.employeeCode}`).sort(
    (a, b) =>
      b.payslipMonth.localeCompare(a.payslipMonth) || a.employeeName.localeCompare(b.employeeName),
  )
}

// --- salary sheet, reports, dashboard ---------------------------------------------------------

function salarySheet(url: URL): SalarySheet {
  const payrollId = param(url, 'payrollId')
  const month = param(url, 'month')
  const slips = payslips
    .all()
    .filter(
      (slip) =>
        !slip.isFinalSettlement &&
        (payrollId === undefined || slip.payrollId === payrollId) &&
        (month === undefined || slip.payslipMonth === month),
    )
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
  const columns = new Map<string, SalarySheet['columns'][number]>()
  for (const slip of slips) {
    for (const item of slip.lines) {
      if (!item.calculateOnly)
        columns.set(item.payItemId, {
          payItemId: item.payItemId,
          payItemName: item.payItemName,
          itemType: item.itemType,
        })
    }
  }
  const sumLines = (slip: StoredPayslip, code: string) =>
    slip.lines
      .filter((item) => item.systemCode === code)
      .reduce((sum, item) => sum + item.amount, 0)
  const rows: SalarySheetRow[] = slips.map((slip) => ({
    payslipId: slip.id,
    payrollId: slip.payrollId ?? '',
    payrollName: slip.payrollName ?? '',
    employeeId: slip.employeeId,
    employeeCode: slip.employeeCode,
    employeeName: slip.employeeName,
    paymentMethod: slip.paymentMethod,
    status: slip.status,
    gross: slip.gross ?? 0,
    overtime: sumLines(slip, 'overtime'),
    tax: slip.taxAmount ?? 0,
    leaveDeduction: sumLines(slip, 'leave_deduction'),
    shortDeduction: sumLines(slip, 'short_deduction'),
    absentDeduction: sumLines(slip, 'absent_deduction'),
    totalEarnings: slip.totalEarnings ?? 0,
    totalReimbursements: slip.totalReimbursements ?? 0,
    totalDeductions: slip.totalDeductions ?? 0,
    netPayable: slip.netPayable ?? 0,
    items: slip.lines
      .filter((item) => !item.calculateOnly)
      .map((item) => ({
        payItemId: item.payItemId,
        payItemName: item.payItemName,
        itemType: item.itemType,
        amount: item.amount,
      })),
  }))
  const total = (key: keyof SalarySheet['totals']) =>
    Math.round(rows.reduce((sum, row) => sum + row[key], 0) * 100) / 100
  return {
    rounding: 'none',
    printSignature: false,
    columns: [...columns.values()],
    rows,
    totals: {
      gross: total('gross'),
      overtime: total('overtime'),
      tax: total('tax'),
      leaveDeduction: total('leaveDeduction'),
      shortDeduction: total('shortDeduction'),
      absentDeduction: total('absentDeduction'),
      totalEarnings: total('totalEarnings'),
      totalReimbursements: total('totalReimbursements'),
      totalDeductions: total('totalDeductions'),
      netPayable: total('netPayable'),
    },
  }
}

function dashboard(url: URL): PayrollDashboard {
  const year = Number(param(url, 'year') ?? new Date().getFullYear())
  const slips = payslips.all().filter((slip) => slip.payslipMonth.startsWith(String(year)))
  const months = [...new Set(slips.map((slip) => slip.payslipMonth))].sort()
  const breakupMonth = param(url, 'month') ?? months.at(-1) ?? null
  const breakup = new Map<string, PayrollDashboard['salaryBreakup'][number]>()
  for (const slip of slips.filter((item) => item.payslipMonth === breakupMonth)) {
    for (const item of slip.lines) {
      const current = breakup.get(item.payItemId)
      breakup.set(item.payItemId, {
        payItemId: item.payItemId,
        payItemName: item.payItemName,
        itemType: item.itemType,
        amount: (current?.amount ?? 0) + item.amount,
      })
    }
  }
  const runs = payrolls.all()
  const sum = (list: readonly StoredPayslip[], pick: (slip: StoredPayslip) => number | null) =>
    list.reduce((total, slip) => total + (pick(slip) ?? 0), 0)
  return {
    year,
    breakupMonth,
    tiles: {
      totalPayrolls: runs.length,
      closedPayrolls: runs.filter((run) => run.status === 'closed').length,
      totalPayslips: slips.length,
      releasedPayslips: slips.filter((slip) => slip.status === 'released').length,
      paidPayslips: slips.filter((slip) => slip.paidAt).length,
      onHoldPayslips: slips.filter((slip) => slip.status === 'on_hold').length,
      unpaidPayslips: slips.filter((slip) => !slip.paidAt).length,
      netPayable: sum(slips, (slip) => slip.netPayable),
      paidAmount: sum(
        slips.filter((slip) => slip.paidAt),
        (slip) => slip.netPayable,
      ),
    },
    salaryStatistics: months.map((month) => {
      const list = slips.filter((slip) => slip.payslipMonth === month)
      return {
        month,
        gross: sum(list, (slip) => slip.gross),
        tax: sum(list, (slip) => slip.taxAmount),
        deductions: sum(list, (slip) => slip.totalDeductions),
        netPayable: sum(list, (slip) => slip.netPayable),
        payslipCount: list.length,
      }
    }),
    salaryBreakup: [...breakup.values()],
  }
}

function payrollSummary(payroll: StoredPayroll): PayrollSummary {
  const slips = payslips.all().filter((slip) => slip.payrollId === payroll.id)
  const sum = (list: readonly StoredPayslip[], pick: (slip: StoredPayslip) => number | null) =>
    list.reduce((total, slip) => total + (pick(slip) ?? 0), 0)
  const items = new Map<string, PayrollSummary['payItems'][number]>()
  for (const slip of slips) {
    for (const item of slip.lines) {
      const current = items.get(item.payItemId)
      items.set(item.payItemId, {
        payItemId: item.payItemId,
        payItemName: item.payItemName,
        itemType: item.itemType,
        amount: (current?.amount ?? 0) + item.amount,
        employerContribution:
          (current?.employerContribution ?? 0) + (item.employerContribution ?? 0),
        employeeCount: (current?.employeeCount ?? 0) + 1,
      })
    }
  }
  const held = slips.filter((slip) => slip.status === 'on_hold')
  return {
    payrollId: payroll.id,
    code: payroll.code,
    name: payroll.name,
    kind: payroll.kind,
    payrollMonth: payroll.payrollMonth,
    workDate: payroll.workDate,
    status: payroll.status,
    employeeCount: payroll.employeeIds.length,
    gross: sum(slips, (slip) => slip.gross),
    totalEarnings: sum(slips, (slip) => slip.totalEarnings),
    totalDeductions: sum(slips, (slip) => slip.totalDeductions),
    totalReimbursements: sum(slips, (slip) => slip.totalReimbursements),
    tax: sum(slips, (slip) => slip.taxAmount),
    netPayable: sum(slips, (slip) => slip.netPayable),
    onHoldCount: held.length,
    onHoldAmount: sum(held, (slip) => slip.netPayable),
    paidAmount: sum(
      slips.filter((slip) => slip.paidAt),
      (slip) => slip.netPayable,
    ),
    payItems: [...items.values()],
  }
}

function employeeAccountReport(url: URL): EmployeeAccountReportRow[] {
  const from = param(url, 'from')
  const to = param(url, 'to')
  const department = param(url, 'departmentId')
  const inRange = (date: string) => (!from || date >= from) && (!to || date <= to)
  const rows = DIRECTORY.filter(
    (employee) => department === undefined || departmentId(employee.department) === department,
  ).map((employee): EmployeeAccountReportRow => {
    const person = personFields(employee.id)
    const accounts = new Map<string, EmployeeAccountReportRow['accounts'][number]>()
    for (const entry of accountEntries.all()) {
      if (entry.employeeId !== employee.id || !inRange(entry.entryMonth)) continue
      const current = accounts.get(entry.accountTypeId) ?? {
        accountTypeId: entry.accountTypeId,
        accountName: entry.accountName,
        credit: 0,
        debit: 0,
        balance: 0,
      }
      const credit = current.credit + entry.credit
      const debit = current.debit + entry.debit
      accounts.set(entry.accountTypeId, { ...current, credit, debit, balance: credit - debit })
    }
    return {
      employeeId: employee.id,
      employeeCode: person.employeeCode,
      employeeName: person.employeeName,
      departmentName: person.departmentName,
      taxPaid: payslips
        .all()
        .filter(
          (slip) =>
            slip.employeeId === employee.id &&
            slip.status === 'released' &&
            inRange(slip.payslipMonth),
        )
        .reduce((sum, slip) => sum + (slip.taxAmount ?? 0), 0),
      taxRebate: taxRebates
        .all()
        .filter((rebate) => rebate.employeeId === employee.id && inRange(rebate.rebateDate))
        .reduce((sum, rebate) => sum + rebate.amount, 0),
      accounts: [...accounts.values()],
    }
  })
  return searched(url, rows, (row) => `${row.employeeName} ${row.employeeCode}`)
}

// --- handlers ----------------------------------------------------------------------------------

const payrollRoutes = (path: string) => base(path)

export const payrollRunHandlers = [
  // Monthly payrolls
  http.get(
    payrollRoutes('/payrolls'),
    guarded(({ request }) => {
      const url = new URL(request.url)
      const status = param(url, 'status')
      const month = param(url, 'month')
      const list = payrolls
        .all()
        .filter(
          (payroll) =>
            payroll.kind === 'monthly' &&
            (status === undefined || payroll.status === status) &&
            (month === undefined || payroll.payrollMonth === month),
        )
        .sort((a, b) => b.code.localeCompare(a.code))
      return Promise.resolve(
        page(url, searched(url, list, (payroll) => `${payroll.name} ${payroll.code}`).map(rowOf)),
      )
    }),
  ),

  http.post(
    payrollRoutes('/payrolls'),
    guarded(async ({ request }) => {
      const parsed = await readBody(request, payrollInput)
      if (!parsed.success) return rejected(parsed.error)
      const input = parsed.data
      if (
        payrolls.all().some((payroll) => payroll.name.toLowerCase() === input.name.toLowerCase())
      ) {
        return conflict('A payroll with this name already exists', 'DUPLICATE', {
          name: 'A payroll with this name already exists',
        })
      }
      const structure = taxStructures.find(input.taxStructureId)
      const bank = banks.find(input.disbursementBankId)
      const code = nextCode(
        'PR-',
        payrolls.all().map((payroll) => payroll.code),
      )
      const payroll: StoredPayroll = {
        id: `pr_${Math.random().toString(36).slice(2, 8)}`,
        code,
        name: input.name.trim(),
        kind: 'monthly',
        payrollMonth: input.payrollMonth,
        workDate: null,
        timeSlotId: null,
        timeSlotName: null,
        currency: input.currency,
        taxStructureId: input.taxStructureId,
        taxStructureName: structure?.name ?? null,
        taxApplicable: input.taxApplicable,
        processingMode: input.processingMode,
        processingDate: input.processingDate,
        applicableDays: input.applicableDays,
        fixedDays: input.applicableDays === 'fixed' ? (input.fixedDays ?? null) : null,
        disbursementBankId: input.disbursementBankId,
        disbursementBankName: bank?.bankName ?? null,
        description: input.description ?? null,
        status: 'open',
        lastRunAt: null,
        closedAt: null,
        closedByUserId: null,
        employeeCount: 0,
        payslipCount: 0,
        totalEarnings: 0,
        totalDeductions: 0,
        netPayable: 0,
        payItems: payItemRows(input.payItems),
        createdAt: now(),
        updatedAt: null,
        rowVersion: nextRowVersion(),
        employeeIds: [],
        history: [],
      }
      payrolls.insert(payroll)
      return HttpResponse.json({ data: rowOf(payroll) }, { status: 201 })
    }),
  ),

  http.get(
    payrollRoutes('/payrolls/:id'),
    guarded(({ params }) => {
      const payroll = findRun(params.id, 'monthly')
      return Promise.resolve(payroll ? ok(rowOf(payroll)) : notFound('payroll'))
    }),
  ),

  http.put(
    payrollRoutes('/payrolls/:id'),
    guarded(async ({ request, params }) => {
      const payroll = findRun(params.id, 'monthly')
      if (!payroll) return notFound('payroll')
      if (payroll.status === 'closed') return closedRun()
      const parsed = await readBody(request, payrollInput)
      if (!parsed.success) return rejected(parsed.error)
      const input = parsed.data
      if (input.rowVersion && input.rowVersion !== payroll.rowVersion) return staleRun()
      const next: StoredPayroll = {
        ...payroll,
        name: input.name.trim(),
        payrollMonth: input.payrollMonth,
        currency: input.currency,
        taxStructureId: input.taxStructureId,
        taxStructureName: taxStructures.find(input.taxStructureId)?.name ?? null,
        taxApplicable: input.taxApplicable,
        processingMode: input.processingMode,
        processingDate: input.processingDate,
        applicableDays: input.applicableDays,
        fixedDays: input.applicableDays === 'fixed' ? (input.fixedDays ?? null) : null,
        disbursementBankId: input.disbursementBankId,
        disbursementBankName: banks.find(input.disbursementBankId)?.bankName ?? null,
        description: input.description ?? null,
        payItems: input.payItems ? payItemRows(input.payItems) : payroll.payItems,
        updatedAt: now(),
        rowVersion: nextRowVersion(),
      }
      payrolls.update(payroll.id, next)
      return ok(rowOf(next))
    }),
  ),

  http.delete(
    payrollRoutes('/payrolls/:id'),
    guarded(({ request, params }) => {
      const payroll = findRun(params.id, 'monthly')
      if (!payroll) return Promise.resolve(notFound('payroll'))
      const url = new URL(request.url)
      const rowVersion = param(url, 'rowVersion')
      if (rowVersion && rowVersion !== payroll.rowVersion) return Promise.resolve(staleRun())
      const slips = payslips.all().filter((slip) => slip.payrollId === payroll.id)
      if (payroll.status === 'closed' || slips.some((slip) => slip.status === 'released')) {
        return Promise.resolve(
          conflict('This payroll has released payslips. It cannot be deleted', 'PAYROLL_CLOSED'),
        )
      }
      for (const slip of slips) payslips.remove(slip.id)
      payrolls.remove(payroll.id)
      return Promise.resolve(new HttpResponse(null, { status: 204 }))
    }),
  ),

  http.get(
    payrollRoutes('/payrolls/:id/employees'),
    guarded(({ request, params }) => {
      const payroll = findRun(params.id, 'monthly')
      if (!payroll) return Promise.resolve(notFound('payroll'))
      const url = new URL(request.url)
      const rows = payroll.employeeIds.map((employeeId) => employeeRow(payroll.id, employeeId))
      return Promise.resolve(
        ok(
          searched(url, rows, (row) => `${row.employeeName} ${row.employeeCode}`).sort((a, b) =>
            a.employeeName.localeCompare(b.employeeName),
          ),
        ),
      )
    }),
  ),

  http.put(
    payrollRoutes('/payrolls/:id/employees'),
    guarded(async ({ request, params }) => {
      const payroll = payrolls.find(id(params.id))
      if (!payroll) return notFound('payroll')
      if (payroll.status === 'closed') return closedRun()
      const parsed = await readBody(request, z.object({ employeeIds: z.array(z.string()) }))
      if (!parsed.success) return rejected(parsed.error)
      const employeeIds = [...new Set(parsed.data.employeeIds)].filter((employeeId) =>
        findEmployee(employeeId),
      )
      const released = payslips
        .all()
        .filter((slip) => slip.payrollId === payroll.id && slip.status === 'released')
        .map((slip) => slip.employeeId)
      if (released.some((employeeId) => !employeeIds.includes(employeeId))) {
        return conflict('A person with a released payslip cannot be taken off the payroll')
      }
      payrolls.update(payroll.id, {
        ...payroll,
        employeeIds,
        employeeCount: employeeIds.length,
        rowVersion: nextRowVersion(),
      })
      return ok({ employeeCount: employeeIds.length, added: null, skipped: null })
    }),
  ),

  http.post(
    payrollRoutes('/payrolls/:id/employees/add'),
    guarded(async ({ request, params }) => {
      const payroll = findRun(params.id, 'monthly')
      if (!payroll) return notFound('payroll')
      if (payroll.status === 'closed') return closedRun()
      const parsed = await readBody(
        request,
        z.object({
          branchId: z.string().nullable().optional(),
          departmentId: z.string().nullable().optional(),
          employeeStatus: z.string().nullable().optional(),
        }),
      )
      if (!parsed.success) return rejected(parsed.error)
      const filter = parsed.data
      const matching = DIRECTORY.filter(
        (employee) =>
          (!filter.branchId || employee.branchId === filter.branchId) &&
          (!filter.departmentId || departmentId(employee.department) === filter.departmentId) &&
          (filter.employeeStatus !== 'active' || isActive(employee.id)),
      ).map((employee) => employee.id)
      const added = matching.filter((employeeId) => !payroll.employeeIds.includes(employeeId))
      const employeeIds = [...payroll.employeeIds, ...added]
      payrolls.update(payroll.id, {
        ...payroll,
        employeeIds,
        employeeCount: employeeIds.length,
        rowVersion: nextRowVersion(),
      })
      return ok({
        employeeCount: employeeIds.length,
        added: added.length,
        skipped: matching.length - added.length,
      })
    }),
  ),

  http.post(
    payrollRoutes('/payrolls/:id/run'),
    guarded(({ params }) => {
      const payroll = findRun(params.id, 'monthly')
      if (!payroll) return Promise.resolve(notFound('payroll'))
      if (payroll.status === 'closed') return Promise.resolve(closedRun())
      if (payroll.employeeIds.length === 0) {
        return Promise.resolve(
          invalid('Add employees to the payroll before running it.', {
            employeeIds: 'Add employees to the payroll before running it.',
          }),
        )
      }
      return Promise.resolve(ok(runMonthly(payroll)))
    }),
  ),

  http.post(
    payrollRoutes('/payrolls/:id/close'),
    guarded(async ({ request, params }) => {
      const payroll = findRun(params.id, 'monthly')
      if (!payroll) return notFound('payroll')
      const parsed = await readBody(request, z.object({ rowVersion: z.string() }))
      if (!parsed.success) return rejected(parsed.error)
      if (payroll.status === 'closed') return closedRun()
      if (parsed.data.rowVersion !== payroll.rowVersion) return staleRun()
      if (
        payroll.status === 'open' ||
        !payslips.all().some((slip) => slip.payrollId === payroll.id)
      ) {
        return conflict('Run the payroll before closing it', 'PAYROLL_NOT_RUN')
      }
      closeRun(payroll)
      return ok(rowOf(refresh(payroll.id) ?? payroll))
    }),
  ),

  ...(['hold', 'unhold'] as const).map((action) =>
    http.post(
      payrollRoutes(`/payrolls/:id/${action}`),
      guarded(({ params }) => {
        const payroll = findRun(params.id, 'monthly')
        if (!payroll) return Promise.resolve(notFound('payroll'))
        if (payroll.status === 'closed') return Promise.resolve(closedRun())
        const hold = action === 'hold'
        for (const slip of payslips.all().filter((item) => item.payrollId === payroll.id)) {
          if (slip.status === 'released') continue
          payslips.update(slip.id, {
            ...slip,
            status: hold ? 'on_hold' : 'ready',
            payrollStatus: hold ? 'on_hold' : 'running',
          })
        }
        const next: StoredPayroll = {
          ...payroll,
          status: hold ? 'on_hold' : payroll.lastRunAt ? 'running' : 'open',
          rowVersion: nextRowVersion(),
        }
        payrolls.update(payroll.id, next)
        return Promise.resolve(ok(rowOf(next)))
      }),
    ),
  ),

  http.get(
    payrollRoutes('/payrolls/:id/history'),
    guarded(({ params }) => {
      const payroll = findRun(params.id, 'monthly')
      return Promise.resolve(payroll ? ok([...payroll.history].reverse()) : notFound('payroll'))
    }),
  ),

  http.get(
    payrollRoutes('/payrolls/:id/errors'),
    guarded(({ request, params }) => {
      const payroll = findRun(params.id, 'monthly')
      if (!payroll) return Promise.resolve(notFound('payroll'))
      const runLogId = param(new URL(request.url), 'runLogId')
      return Promise.resolve(
        ok(
          (payroll.errors ?? []).filter(
            (entry) => runLogId === undefined || entry.payrollRunLogId === runLogId,
          ),
        ),
      )
    }),
  ),

  // Daily wages
  http.get(
    payrollRoutes('/daily-wages'),
    guarded(({ request }) => {
      const url = new URL(request.url)
      const status = param(url, 'status')
      const slot = param(url, 'timeSlotId')
      const from = param(url, 'from')
      const to = param(url, 'to')
      const list = payrolls
        .all()
        .filter(
          (payroll) =>
            payroll.kind === 'daily_wage' &&
            (status === undefined || payroll.status === status) &&
            (slot === undefined || payroll.timeSlotId === slot) &&
            (from === undefined || (payroll.workDate ?? '') >= from) &&
            (to === undefined || (payroll.workDate ?? '') <= to),
        )
        .sort((a, b) => (b.workDate ?? '').localeCompare(a.workDate ?? ''))
      return Promise.resolve(
        page(url, searched(url, list, (payroll) => `${payroll.name} ${payroll.code}`).map(rowOf)),
      )
    }),
  ),

  http.post(
    payrollRoutes('/daily-wages'),
    guarded(async ({ request }) => {
      const parsed = await readBody(request, dailyWageInput)
      if (!parsed.success) return rejected(parsed.error)
      const input = parsed.data
      const slot = timeSlots().find((item) => item.id === input.timeSlotId)
      if (!slot) return invalid('Choose the time slot.', { timeSlotId: 'Choose the time slot.' })
      if (
        payrolls
          .all()
          .some(
            (payroll) =>
              payroll.kind === 'daily_wage' &&
              payroll.workDate === input.workDate &&
              payroll.timeSlotId === input.timeSlotId,
          )
      ) {
        return conflict(
          'There is already a daily wage payroll for this day and time slot',
          'DUPLICATE',
        )
      }
      const employeeIds = [...new Set(input.employeeIds)]
      const payroll: StoredPayroll = withPendingRows({
        id: `dw_${Math.random().toString(36).slice(2, 8)}`,
        code: nextCode(
          'PR-',
          payrolls.all().map((item) => item.code),
        ),
        name: input.name.trim(),
        kind: 'daily_wage',
        payrollMonth: null,
        workDate: input.workDate,
        timeSlotId: slot.id,
        timeSlotName: slot.name,
        currency: null,
        taxStructureId: null,
        taxStructureName: null,
        taxApplicable: false,
        processingMode: null,
        processingDate: null,
        applicableDays: 'actual',
        fixedDays: null,
        disbursementBankId: null,
        disbursementBankName: null,
        description: null,
        status: 'open',
        lastRunAt: null,
        closedAt: null,
        closedByUserId: null,
        employeeCount: employeeIds.length,
        payslipCount: 0,
        totalEarnings: 0,
        totalDeductions: 0,
        netPayable: 0,
        payItems: [],
        createdAt: now(),
        updatedAt: null,
        rowVersion: nextRowVersion(),
        employeeIds,
        history: [],
        rows: [],
      })
      payrolls.insert(payroll)
      return HttpResponse.json({ data: detailOf(payroll) }, { status: 201 })
    }),
  ),

  http.get(
    payrollRoutes('/daily-wages/:id'),
    guarded(({ params }) => {
      const payroll = findRun(params.id, 'daily_wage')
      return Promise.resolve(payroll ? ok(detailOf(withPendingRows(payroll))) : notFound('payroll'))
    }),
  ),

  http.put(
    payrollRoutes('/daily-wages/:id'),
    guarded(async ({ request, params }) => {
      const payroll = findRun(params.id, 'daily_wage')
      if (!payroll) return notFound('payroll')
      if (payroll.status === 'closed') return closedRun()
      const parsed = await readBody(request, dailyWageEdit)
      if (!parsed.success) return rejected(parsed.error)
      if (parsed.data.rowVersion !== payroll.rowVersion) return staleRun()
      const edits = new Map(parsed.data.rows.map((row) => [row.employeeId, row]))
      const rows = (payroll.rows ?? []).map((row) => {
        const edit = edits.get(row.employeeId)
        const slip = row.payslipId ? payslips.find(row.payslipId) : undefined
        if (!edit || !slip) return row
        const netPayable = edit.totalEarnings - edit.totalDeductions
        payslips.update(slip.id, {
          ...slip,
          totalEarnings: edit.totalEarnings,
          totalDeductions: edit.totalDeductions,
          netPayable,
          isManuallyUpdated: true,
          rowVersion: nextRowVersion(),
        })
        return {
          ...row,
          totalEarnings: edit.totalEarnings,
          totalDeductions: edit.totalDeductions,
          netPayable,
          isManuallyUpdated: true,
        }
      })
      payrolls.update(payroll.id, {
        ...payroll,
        name: parsed.data.name,
        rows,
        rowVersion: nextRowVersion(),
        updatedAt: now(),
      })
      const next = refresh(payroll.id) ?? payroll
      return ok(detailOf(withPendingRows(next)))
    }),
  ),

  http.put(
    payrollRoutes('/daily-wages/:id/employees'),
    guarded(async ({ request, params }) => {
      const payroll = findRun(params.id, 'daily_wage')
      if (!payroll) return notFound('payroll')
      if (payroll.status === 'closed') return closedRun()
      const parsed = await readBody(request, z.object({ employeeIds: z.array(z.string()) }))
      if (!parsed.success) return rejected(parsed.error)
      const employeeIds = [...new Set(parsed.data.employeeIds)]
      for (const slip of payslips.all().filter((item) => item.payrollId === payroll.id)) {
        if (!employeeIds.includes(slip.employeeId)) payslips.remove(slip.id)
      }
      payrolls.update(
        payroll.id,
        withPendingRows({ ...payroll, employeeIds, rowVersion: nextRowVersion() }),
      )
      refresh(payroll.id)
      return ok({ employeeCount: employeeIds.length, added: null, skipped: null })
    }),
  ),

  http.delete(
    payrollRoutes('/daily-wages/:id'),
    guarded(({ params }) => {
      const payroll = findRun(params.id, 'daily_wage')
      if (!payroll) return Promise.resolve(notFound('payroll'))
      if (payroll.status === 'closed') return Promise.resolve(closedRun())
      for (const slip of payslips.all().filter((item) => item.payrollId === payroll.id)) {
        payslips.remove(slip.id)
      }
      payrolls.remove(payroll.id)
      return Promise.resolve(new HttpResponse(null, { status: 204 }))
    }),
  ),

  http.post(
    payrollRoutes('/daily-wages/:id/process'),
    guarded(({ params }) => {
      const payroll = findRun(params.id, 'daily_wage')
      if (!payroll) return Promise.resolve(notFound('payroll'))
      if (payroll.status === 'closed') return Promise.resolve(closedRun())
      if (payroll.employeeIds.length === 0) {
        return Promise.resolve(invalid('Add employees to the payroll before processing it.'))
      }
      return Promise.resolve(ok(processDailyWage(payroll)))
    }),
  ),

  http.post(
    payrollRoutes('/daily-wages/:id/close'),
    guarded(async ({ request, params }) => {
      const payroll = findRun(params.id, 'daily_wage')
      if (!payroll) return notFound('payroll')
      const parsed = await readBody(request, z.object({ rowVersion: z.string() }))
      if (!parsed.success) return rejected(parsed.error)
      if (payroll.status === 'closed') return closedRun()
      if (parsed.data.rowVersion !== payroll.rowVersion) return staleRun()
      if (!payslips.all().some((slip) => slip.payrollId === payroll.id)) {
        return conflict('Process the payroll before closing it', 'PAYROLL_NOT_RUN')
      }
      closeRun(payroll)
      return ok(rowOf(refresh(payroll.id) ?? payroll))
    }),
  ),

  http.post(
    payrollRoutes('/daily-wages/:id/vouchers'),
    guarded(({ params }) => {
      const payroll = findRun(params.id, 'daily_wage')
      if (!payroll) return Promise.resolve(notFound('payroll'))
      if (payroll.status !== 'closed') {
        return Promise.resolve(
          conflict('Close the payroll before making its vouchers', 'PAYROLL_NOT_CLOSED'),
        )
      }
      let created = 0
      const rows = (payroll.rows ?? []).map((row) => {
        if (row.voucherId || !row.payslipId || !row.netPayable) return row
        const voucherNo = nextCode(
          'VCH-',
          vouchers.all().map((item) => item.voucherNo),
        )
        const person = personFields(row.employeeId)
        const voucher: VoucherRow = {
          id: `vc_${Math.random().toString(36).slice(2, 8)}`,
          voucherNo,
          employeeId: row.employeeId,
          employeeCode: person.employeeCode,
          employeeName: person.employeeName,
          departmentName: person.departmentName,
          designationName: person.designationName,
          voucherType: 'daily_wage',
          voucherDate: payroll.workDate ?? format(new Date(), 'yyyy-MM-dd'),
          currency: 'PKR',
          amount: row.netPayable,
          paymentMethod: 'cash',
          purpose: `Daily wages ${payroll.name}`,
          notes: null,
          fileId: null,
          file: null,
          payrollId: payroll.id,
          payrollName: payroll.name,
          requestedById: null,
          requestedByName: null,
          approvedById: null,
          approvedByName: null,
          approvedAt: null,
          verifiedById: null,
          verifiedByName: null,
          verifiedAt: null,
          remarks: null,
          status: 'approved',
          createdAt: now(),
          updatedAt: null,
          rowVersion: nextRowVersion(),
        }
        vouchers.insert(voucher)
        created += 1
        return { ...row, voucherId: voucher.id, voucherNo, voucherStatus: voucher.status }
      })
      payrolls.update(payroll.id, { ...payroll, rows })
      return Promise.resolve(ok({ created }))
    }),
  ),

  http.get(
    payrollRoutes('/daily-wages/:id/errors'),
    guarded(({ params }) => {
      const payroll = findRun(params.id, 'daily_wage')
      return Promise.resolve(payroll ? ok(payroll.errors ?? []) : notFound('payroll'))
    }),
  ),

  // Salary sheet
  http.get(
    payrollRoutes('/salary-sheet'),
    guarded(({ request }) => Promise.resolve(ok(salarySheet(new URL(request.url))))),
  ),

  // Payslips (the fixed paths first, so `summary` / `hold` never read as an id)
  http.get(
    payrollRoutes('/payslips'),
    guarded(({ request }) => {
      const url = new URL(request.url)
      return Promise.resolve(page(url, visibleSlips(url).map(listRow)))
    }),
  ),

  http.get(
    payrollRoutes('/payslips/summary'),
    guarded(({ request }) => {
      const employeeId = param(new URL(request.url), 'employeeId') ?? ME
      const person = personFields(employeeId)
      const accounts = new Map<string, AccountBalance>()
      for (const entry of accountEntries.all().filter((item) => item.employeeId === employeeId)) {
        const current = accounts.get(entry.accountTypeId) ?? {
          accountTypeId: entry.accountTypeId,
          accountName: entry.accountName,
          category: entry.accountCategory,
          credit: 0,
          debit: 0,
          balance: 0,
        }
        const credit = current.credit + entry.credit
        const debit = current.debit + entry.debit
        accounts.set(entry.accountTypeId, { ...current, credit, debit, balance: credit - debit })
      }
      const advances = vouchers
        .all()
        .filter(
          (voucher) =>
            voucher.employeeId === employeeId &&
            voucher.voucherType === 'salary_advance' &&
            voucher.status === 'processed',
        )
        .reduce((sum, voucher) => sum + voucher.amount, 0)
      return Promise.resolve(
        ok({
          employeeId,
          employeeCode: person.employeeCode,
          employeeName: person.employeeName,
          outstandingLoan: 0,
          advancesPaid: advances,
          accounts: [...accounts.values()],
        }),
      )
    }),
  ),

  ...(['hold', 'unhold', 'pay', 'recalculate'] as const).map((action) =>
    http.post(
      payrollRoutes(`/payslips/${action}`),
      guarded(async ({ request }) => {
        const parsed = await readBody(request, z.object({ ids: z.array(z.string()).min(1) }))
        if (!parsed.success) return rejected(parsed.error)
        let changed = 0
        const errors: string[] = []
        for (const slipId of parsed.data.ids) {
          const slip = payslips.find(slipId)
          if (!slip) {
            errors.push(`Payslip ${slipId} was not found.`)
            continue
          }
          const result = applyAction(slip, action)
          if (typeof result === 'string') errors.push(`${slip.employeeName}: ${result}`)
          else changed += 1
        }
        return ok({ changed, errors })
      }),
    ),
  ),

  http.get(
    payrollRoutes('/payslips/:id'),
    guarded(({ params }) => {
      const slip = payslips.find(id(params.id))
      return Promise.resolve(slip ? ok(detail(slip)) : notFound('payslip'))
    }),
  ),

  http.put(
    payrollRoutes('/payslips/:id'),
    guarded(async ({ request, params }) => {
      const slip = payslips.find(id(params.id))
      if (!slip) return notFound('payslip')
      const parsed = await readBody(request, payslipEdit)
      if (!parsed.success) return rejected(parsed.error)
      if (parsed.data.rowVersion !== slip.rowVersion) {
        return conflict('Someone else changed this payslip. Reload it and try again')
      }
      const run = slip.payrollId ? payrolls.find(slip.payrollId) : undefined
      if (run?.status === 'closed' || slip.status === 'released') {
        return conflict(
          'This payslip is released or its payroll is closed. It cannot be changed',
          'PAYSLIP_LOCKED',
        )
      }
      if (run?.kind === 'daily_wage')
        return invalid('Daily wages are edited on the daily wages payroll.')
      let next: StoredPayslip = { ...slip }
      for (const edit of parsed.data.lines) {
        const current = next.lines.find((item) => item.payItemId === edit.payItemId)
        const known = payItems.find(edit.payItemId)
        if (!current && !known)
          return invalid('A pay item was not found.', { lines: 'A pay item was not found.' })
        if (current?.amount === edit.amount) continue
        next = logChange(next, {
          fieldName: current?.payItemName ?? known?.name ?? edit.payItemId,
          oldValue: current ? String(current.amount) : null,
          newValue: String(edit.amount),
          actionName: current ? 'update' : 'add',
        })
        next.lines = current
          ? next.lines.map((item) =>
              item.payItemId === edit.payItemId
                ? {
                    ...item,
                    amount: edit.amount,
                    employerContribution: edit.employerContribution ?? item.employerContribution,
                    isManuallyUpdated: true,
                  }
                : item,
            )
          : [
              ...next.lines,
              {
                id: edit.payItemId,
                payItemId: edit.payItemId,
                payItemName: known?.name ?? edit.payItemId,
                payItemLabel: known?.label ?? null,
                itemType: known?.itemType ?? 'earning',
                systemCode: known?.systemCode ?? null,
                amount: edit.amount,
                employerContribution: edit.employerContribution ?? null,
                isTaxable: known?.isTaxable ?? false,
                isManuallyUpdated: true,
                isDisplayOnly: known?.isDisplayOnly ?? false,
                calculateOnly: false,
              },
            ]
      }
      const saved = withTotals({
        ...next,
        isManuallyUpdated: true,
        updatedAt: now(),
        rowVersion: nextRowVersion(),
      })
      payslips.update(slip.id, saved)
      if (slip.payrollId) refresh(slip.payrollId)
      return ok(detail(saved))
    }),
  ),

  ...(['hold', 'unhold', 'pay', 'recalculate'] as const).map((action) =>
    http.post(
      payrollRoutes(`/payslips/:id/${action}`),
      guarded(({ params }) => {
        const slip = payslips.find(id(params.id))
        if (!slip) return Promise.resolve(notFound('payslip'))
        const result = applyAction(slip, action)
        return Promise.resolve(
          typeof result === 'string' ? conflict(result, 'PAYSLIP_STATUS') : ok(detail(result)),
        )
      }),
    ),
  ),

  http.get(
    payrollRoutes('/payslips/:id/history'),
    guarded(({ params }) => {
      const slip = payslips.find(id(params.id))
      return Promise.resolve(slip ? ok([...(slip.history ?? [])].reverse()) : notFound('payslip'))
    }),
  ),

  // Reports and the dashboard
  http.get(
    payrollRoutes('/reports/employee-accounts'),
    guarded(({ request }) => {
      const url = new URL(request.url)
      return Promise.resolve(page(url, employeeAccountReport(url)))
    }),
  ),

  http.get(
    payrollRoutes('/reports/payroll-summary/:payrollId'),
    guarded(({ params }) => {
      const payroll = payrolls.find(id(params.payrollId))
      return Promise.resolve(payroll ? ok(payrollSummary(payroll)) : notFound('payroll'))
    }),
  ),

  http.get(
    payrollRoutes('/reports/employee-wise'),
    guarded(({ request }) => {
      const url = new URL(request.url)
      const from = param(url, 'from')
      const to = param(url, 'to')
      const employee = param(url, 'employeeId')
      const department = param(url, 'departmentId')
      const rows = payslips
        .all()
        .filter((slip) => {
          const person = findEmployee(slip.employeeId)
          return (
            (!from || slip.payslipMonth >= from) &&
            (!to || slip.payslipMonth <= to) &&
            (!employee || slip.employeeId === employee) &&
            (!department ||
              (person !== undefined && departmentId(person.department) === department))
          )
        })
        .sort(
          (a, b) =>
            a.employeeName.localeCompare(b.employeeName) ||
            a.payslipMonth.localeCompare(b.payslipMonth),
        )
        .map((slip) => ({
          payslipId: slip.id,
          employeeId: slip.employeeId,
          employeeCode: slip.employeeCode,
          employeeName: slip.employeeName,
          departmentName: slip.departmentName,
          payslipMonth: slip.payslipMonth,
          payrollName: slip.payrollName,
          isFinalSettlement: slip.isFinalSettlement,
          gross: slip.gross,
          totalEarnings: slip.totalEarnings,
          totalReimbursements: slip.totalReimbursements,
          totalDeductions: slip.totalDeductions,
          taxAmount: slip.taxAmount,
          netPayable: slip.netPayable,
          status: slip.status,
        }))
      return Promise.resolve(
        page(
          url,
          searched(url, rows, (row) => `${row.employeeName} ${row.employeeCode}`),
        ),
      )
    }),
  ),

  http.get(
    payrollRoutes('/reports/daily-wages'),
    guarded(({ request }) => {
      const url = new URL(request.url)
      const from = param(url, 'from')
      const to = param(url, 'to')
      const rows = payrolls
        .all()
        .filter(
          (payroll) =>
            payroll.kind === 'daily_wage' &&
            (!from || (payroll.workDate ?? '') >= from) &&
            (!to || (payroll.workDate ?? '') <= to),
        )
        .map((payroll) => {
          const made = vouchers.all().filter((voucher) => voucher.payrollId === payroll.id)
          return {
            payrollId: payroll.id,
            code: payroll.code,
            name: payroll.name,
            workDate: payroll.workDate ?? '',
            timeSlotName: payroll.timeSlotName,
            status: payroll.status,
            employeeCount: payroll.employeeIds.length,
            workedMinutes: (payroll.rows ?? []).reduce(
              (sum, row) => sum + (row.workedMinutes ?? 0),
              0,
            ),
            netPayable: payroll.netPayable,
            voucherCount: made.length,
            vouchersProcessed: made.filter((voucher) => voucher.status === 'processed').length,
          }
        })
      return Promise.resolve(page(url, rows))
    }),
  ),

  http.get(
    payrollRoutes('/dashboard'),
    guarded(({ request }) => Promise.resolve(ok(dashboard(new URL(request.url))))),
  ),
]
