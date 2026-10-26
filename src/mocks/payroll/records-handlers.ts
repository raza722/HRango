import { format, getDaysInMonth, parseISO, subDays } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  type AccountStatementRow,
  type CurrentSalary,
  type EmployeeAccountRow,
  type FinalSettlementRow,
  type ImportResult,
  type OpeningBalanceDetail,
  type OpeningBalanceEntry,
  type OpeningBalanceRow,
  PAYMENT_METHODS,
  type PayslipDetail,
  type PayslipLine,
  type SalaryRevisionRow,
  VOUCHER_TYPES,
  type VoucherRow,
} from '@/features/payroll'

import { findEmployee } from '../employees/seed'
import { mockFileUrl } from '../files/handlers'
import { branches, jobTitles } from '../settings/handlers'
import { createId, latency, requireAuth } from '../utils'
import {
  accountEntries,
  accountTypes,
  finalSettlements,
  openingBalances,
  payItems,
  payslips,
  salaryRevisions,
  type StoredFinalSettlement,
  type StoredSalaryRevision,
  vouchers,
} from './db'
import {
  base,
  between,
  conflict,
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
import {
  employeeByCode,
  employeeRef,
  isActive,
  nextRowVersion,
  personFields,
  salaryOn,
} from './people'

// Vouchers, final settlement, balances and salary revision, as `/api/payroll/...` serves them.

const authed = async (request: Request) => {
  await latency()
  return requireAuth(request)
}

const now = () => new Date().toISOString().slice(0, 19)
const stamp = () => ({ updatedAt: now(), rowVersion: nextRowVersion() })
const monthStart = (value: string) => `${value.slice(0, 7)}-01`

const id = z.coerce.string().min(1)
const employeeId = id.refine((value) => Boolean(findEmployee(value)), {
  message: 'Choose the employee',
})
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date')
const rowVersion = z.string().nullish()

/** `?rowVersion=` on a delete, or the body's on an edit: must match the stored one. */
const stale = (sent: string | null | undefined, stored: string | null | undefined) =>
  sent !== undefined && sent !== null && sent !== stored

const changedByOthers = (what: string) =>
  conflict(`Someone else changed this ${what}. Reload it and try again`, 'CONFLICT')

/** The people filters lists share: employee, branch, location, department, designation, status. */
function personMatches(url: URL, employee: string): boolean {
  const person = findEmployee(employee)
  const wanted = param(url, 'employeeId')
  const branchId = param(url, 'branchId')
  const locationId = param(url, 'locationId')
  const department = param(url, 'departmentId')
  const designation = param(url, 'designationId')
  const status = param(url, 'employmentStatus')
  if (wanted && employee !== wanted) return false
  if (branchId && person?.branchId !== branchId) return false
  if (
    locationId &&
    (person?.branchId ? branches.find(person.branchId)?.locationId : null) !== locationId
  ) {
    return false
  }
  if (department && (!person || departmentId(person.department) !== department)) return false
  // Designations come from the job-title lookup: match its name.
  if (designation && jobTitles.find(designation)?.name !== person?.jobTitle) return false
  if (status === 'active' && !isActive(employee)) return false
  if (status === 'inactive' && isActive(employee)) return false
  return true
}

const personText = (row: { employeeName: string; employeeCode: string }) =>
  `${row.employeeName} ${row.employeeCode}`

// --- CSV imports ---------------------------------------------------------------------------------

const key = (header: string) => header.toLowerCase().replace(/[^a-z]/g, '')

function splitLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (const char of line) {
    if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) {
      cells.push(current.trim())
      current = ''
    } else current += char
  }
  cells.push(current.trim())
  return cells
}

/** The data lines of an uploaded CSV, keyed by its header (`Employee Code` → `employeecode`). */
async function readUpload(fileId: string, request: Request): Promise<Record<string, string>[]> {
  const response = await fetch(new URL(mockFileUrl(fileId), request.url))
  if (!response.ok) return []
  const lines = (await response.text()).split(/\r?\n/).filter((line) => line.trim() !== '')
  const [header, ...rest] = lines
  if (!header) return []
  const names = splitLine(header).map(key)
  return rest.map((line) => {
    const cells = splitLine(line)
    return Object.fromEntries(names.map((name, index) => [name, cells[index] ?? '']))
  })
}

const importBody = z.union([
  z.object({ fileId: id }),
  z.object({ rows: z.array(z.record(z.string(), z.unknown())).min(1).max(5000) }),
])

/** The rows of an import: given, or read from the uploaded CSV. 422 for neither. */
async function importRows(request: Request) {
  const body = await readBody(request, importBody)
  if (!body.success) {
    return {
      error: invalid('Some fields need your attention.', {
        request: 'Send either rows or fileId (an uploaded CSV file).',
      }),
    }
  }
  if ('fileId' in body.data) return { rows: await readUpload(body.data.fileId, request) }
  return {
    rows: body.data.rows.map((row) =>
      Object.fromEntries(Object.entries(row).map(([name, value]) => [key(name), String(value)])),
    ),
  }
}

const blankToNull = (value: string | undefined) =>
  value === undefined || value.trim() === '' ? null : value
const toAmount = (value: string | undefined) => Number((value ?? '').replace(/,/g, ''))
const toMonth = (value: string | undefined) =>
  /^\d{4}-\d{2}(-\d{2})?$/.test(value ?? '') ? monthStart(value ?? '') : null

// --- Vouchers ------------------------------------------------------------------------------------

const voucherInput = z.object({
  employeeId,
  voucherNo: z.string().trim().max(30).nullish(),
  voucherType: z.enum(VOUCHER_TYPES, { error: 'Choose the voucher type' }),
  voucherDate: isoDay,
  currency: z.string().length(3).nullish(),
  amount: z.number({ error: 'Enter the amount' }).gt(0, 'Input should be greater than 0'),
  paymentMethod: z.enum(PAYMENT_METHODS, { error: 'Choose the payment method' }),
  purpose: z.string().trim().min(1, 'String should have at least 1 character').max(500),
  notes: z.string().max(2000).nullish(),
  fileId: id.nullish(),
  requestedById: id.nullish(),
  rowVersion,
})

const fileRef = (fileId: string | null | undefined) =>
  fileId ? { id: fileId, name: 'Attachment', url: mockFileUrl(fileId) } : null

const decision = z.object({ remarks: z.string().max(2000).nullish(), rowVersion: z.string() })

const voucherHandlers = [
  http.get(base('/vouchers'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const url = new URL(request.url)
    const type = param(url, 'type')
    const status = param(url, 'status')
    const code = (param(url, 'voucherCode') ?? '').toLowerCase()
    const payrollId = param(url, 'payrollId')
    const from = param(url, 'from')
    const to = param(url, 'to')
    const list = searched(url, vouchers.all(), (row) => `${personText(row)} ${row.voucherNo}`)
      .filter(
        (row) =>
          personMatches(url, row.employeeId) &&
          (!type || row.voucherType === type) &&
          (!status || row.status === status) &&
          (!code || row.voucherNo.toLowerCase() === code) &&
          (!payrollId || row.payrollId === payrollId) &&
          (!from || row.voucherDate >= from) &&
          (!to || row.voucherDate <= to) &&
          between(row.amount, numberParam(url, 'amountFrom'), numberParam(url, 'amountTo')),
      )
      .sort((a, b) => b.voucherDate.localeCompare(a.voucherDate) || b.id.localeCompare(a.id))
    return page(url, list)
  }),

  http.get(base('/vouchers/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const found = vouchers.find(String(params.id))
    return found ? ok(found) : notFound('voucher')
  }),

  ...(['post', 'put'] as const).map((method) =>
    http[method](
      base(method === 'post' ? '/vouchers' : '/vouchers/:id'),
      async ({ request, params }) => {
        const denied = await authed(request)
        if (denied) return denied
        const body = await readBody(request, voucherInput)
        if (!body.success) return rejected(body.error)
        const input = body.data
        const current = method === 'put' ? vouchers.find(String(params.id)) : undefined
        if (method === 'put' && !current) return notFound('voucher')
        if (current && stale(input.rowVersion, current.rowVersion))
          return changedByOthers('voucher')
        if (current && current.status !== 'pending') {
          return conflict('Only a pending voucher can be changed', 'VOUCHER_DECIDED', {
            status: 'Only a pending voucher can be changed',
          })
        }
        const voucherNo =
          blankToNull(input.voucherNo ?? undefined) ??
          current?.voucherNo ??
          nextCode(
            'VCH-',
            vouchers.all().map((row) => row.voucherNo),
          )
        if (vouchers.all().some((row) => row.voucherNo === voucherNo && row.id !== current?.id)) {
          return conflict('That voucher number is taken.', 'DUPLICATE', {
            voucherNo: 'That voucher number is taken.',
          })
        }
        const fields = personFields(input.employeeId)
        const requester = input.requestedById ? personFields(input.requestedById) : null
        const row: VoucherRow = {
          ...(current ?? {
            id: createId('vc'),
            payrollId: null,
            payrollName: null,
            approvedById: null,
            approvedByName: null,
            approvedAt: null,
            verifiedById: null,
            verifiedByName: null,
            verifiedAt: null,
            remarks: null,
            status: 'pending' as const,
            createdAt: now(),
          }),
          voucherNo,
          employeeId: input.employeeId,
          employeeCode: fields.employeeCode,
          employeeName: fields.employeeName,
          departmentName: fields.departmentName,
          designationName: fields.designationName,
          voucherType: input.voucherType,
          voucherDate: input.voucherDate,
          currency: input.currency ?? 'PKR',
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          purpose: input.purpose,
          notes: input.notes ?? null,
          fileId: input.fileId ?? null,
          file: fileRef(input.fileId),
          requestedById: input.requestedById ?? null,
          requestedByName: requester?.employeeName ?? null,
          ...stamp(),
          ...(current ? {} : { updatedAt: null }),
        }
        if (current) vouchers.update(row.id, row)
        else vouchers.insert(row)
        return HttpResponse.json({ data: row }, { status: current ? 200 : 201 })
      },
    ),
  ),

  http.delete(base('/vouchers/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const found = vouchers.find(String(params.id))
    if (!found) return notFound('voucher')
    if (stale(param(new URL(request.url), 'rowVersion'), found.rowVersion)) {
      return changedByOthers('voucher')
    }
    if (found.status === 'processed') {
      return conflict('A processed voucher cannot be deleted', 'VOUCHER_PROCESSED', {
        status: 'A processed voucher cannot be deleted',
      })
    }
    vouchers.remove(found.id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(base('/vouchers/:id/:action'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const action = String(params.action)
    if (!['approve', 'reject', 'verify'].includes(action)) return notFound('voucher action')
    const found = vouchers.find(String(params.id))
    if (!found) return notFound('voucher')
    const body = await readBody(request, decision)
    if (!body.success) return rejected(body.error)
    if (stale(body.data.rowVersion, found.rowVersion)) return changedByOthers('voucher')
    if (action !== 'verify' && found.status !== 'pending') {
      return conflict('This voucher was already decided', 'VOUCHER_DECIDED', {
        status: 'This voucher was already decided',
      })
    }
    if (action === 'verify' && found.status !== 'approved') {
      return conflict('Only an approved voucher can be verified', 'VOUCHER_NOT_APPROVED', {
        status: 'Only an approved voucher can be verified',
      })
    }
    const me = personFields(ME)
    const row: VoucherRow =
      action === 'verify'
        ? {
            ...found,
            status: 'processed',
            verifiedById: ME,
            verifiedByName: me.employeeName,
            verifiedAt: now(),
          }
        : {
            ...found,
            status: action === 'approve' ? 'approved' : 'rejected',
            approvedById: ME,
            approvedByName: me.employeeName,
            approvedAt: now(),
          }
    const saved = { ...row, remarks: body.data.remarks ?? found.remarks, ...stamp() }
    vouchers.update(saved.id, saved)
    return ok(saved)
  }),
]

// --- Final settlement ------------------------------------------------------------------------------

/** The API's status: `pending` until worked out, `open` with a payslip, `closed` once closed. */
const settlementStatus = (record: StoredFinalSettlement) =>
  record.status === 'completed' ? 'closed' : record.payslipId ? 'open' : 'pending'

const settlementVersion = (record: StoredFinalSettlement) =>
  `fs-${record.status}-${record.payslipId ?? 'none'}`

function settlementRow(record: StoredFinalSettlement): FinalSettlementRow {
  const fields = personFields(record.employeeId)
  const slip = record.payslipId ? payslips.find(record.payslipId) : undefined
  return {
    id: record.id,
    finalSettlementId: record.payslipId || record.status === 'completed' ? record.id : null,
    employeeId: record.employeeId,
    employeeCode: fields.employeeCode,
    employeeName: fields.employeeName,
    departmentName: fields.departmentName,
    branchName: fields.branchName,
    reason: record.reason,
    resignationDate: record.resignationDate ? `${record.resignationDate}T00:00:00` : null,
    lastWorkingDate: record.lastWorkingDate,
    description: record.description || null,
    status: settlementStatus(record),
    payslipId: record.payslipId,
    totalEarnings: slip?.totalEarnings ?? null,
    totalDeductions: slip?.totalDeductions ?? null,
    netPayable: slip?.netPayable ?? null,
    closedAt: record.closedAt ?? null,
    fileId: record.fileId ?? null,
    file: fileRef(record.fileId),
    rowVersion: settlementVersion(record),
  }
}

/** Pay item fields for a payslip line, from the settings store when it has the item. */
function itemOf(systemCode: string, fallbackId: string, fallbackName: string) {
  const item = payItems.all().find((candidate) => candidate.systemCode === systemCode)
  return {
    payItemId: item?.id ?? fallbackId,
    payItemName: item?.name ?? fallbackName,
    payItemLabel: item?.label ?? null,
  }
}

/** The settlement slip: the last month's salary up to the last working day (a fixture, not the engine). */
function settlementPayslip(
  record: StoredFinalSettlement,
  previousId: string | null,
): PayslipDetail {
  const fields = personFields(record.employeeId)
  const last = parseISO(record.lastWorkingDate)
  const days = last.getDate()
  const monthly = salaryOn(record.employeeId, record.lastWorkingDate)
  const salary = Math.round((monthly * days) / getDaysInMonth(last))
  const lines: PayslipLine[] = [
    {
      id: createId('pl'),
      ...itemOf('salary', 'pi_salary', 'Salary'),
      itemType: 'earning',
      systemCode: 'salary',
      amount: salary,
      employerContribution: null,
      isTaxable: true,
      isManuallyUpdated: false,
      isDisplayOnly: false,
      calculateOnly: false,
    },
  ]
  const slipId = previousId ?? createId('ps_fs')
  return {
    id: slipId,
    payrollId: null,
    payrollCode: null,
    payrollName: null,
    payrollKind: null,
    payrollStatus: null,
    employeeId: record.employeeId,
    employeeCode: fields.employeeCode,
    employeeName: fields.employeeName,
    departmentName: fields.departmentName,
    branchName: fields.branchName,
    payslipMonth: format(last, 'yyyy-MM-01'),
    gross: monthly,
    totalEarnings: salary,
    totalDeductions: 0,
    totalReimbursements: 0,
    netPayable: salary,
    taxAmount: 0,
    status: 'ready',
    paymentMethod: 'bank_transfer',
    releasedAt: null,
    paidAt: null,
    isFinalSettlement: true,
    createdAt: now(),
    updatedAt: null,
    rowVersion: nextRowVersion(),
    designationName: fields.designationName,
    jobTitleName: fields.jobTitleName,
    locationName: fields.locationName,
    joiningDate: fields.joiningDate,
    bankName: null,
    accountNumber: null,
    currency: 'PKR',
    applicableDays: getDaysInMonth(last),
    workedDays: days,
    workedMinutes: null,
    expectedMinutes: null,
    leaveDays: 0,
    absentDays: 0,
    overtimeMinutes: 0,
    taxableIncome: salary,
    isManuallyUpdated: false,
    lines,
    display: {
      template: 'default',
      color: null,
      showSalaryBreakdown: true,
      hideAttendanceSummary: false,
      showEmployeePayItems: true,
      taxPositiveOnly: false,
      notesEnglish: null,
      notesOtherLanguage: null,
    },
  }
}

const settlementHandlers = [
  http.get(base('/final-settlements'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const url = new URL(request.url)
    const status = param(url, 'status')
    const wantedMonth = param(url, 'month')
    const list = searched(
      url,
      finalSettlements.all().filter((record) => record.finalSettlement),
      (record) => `${employeeRef(record.employeeId).name} ${employeeRef(record.employeeId).code}`,
    )
      .filter(
        (record) =>
          personMatches(url, record.employeeId) &&
          (!status || settlementStatus(record) === status) &&
          (!wantedMonth || record.lastWorkingDate.slice(0, 7) === wantedMonth.slice(0, 7)),
      )
      .sort((a, b) => b.lastWorkingDate.localeCompare(a.lastWorkingDate))
      .map(settlementRow)
    return page(url, list)
  }),

  http.get(base('/final-settlements/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const found = finalSettlements.find(String(params.id))
    return found ? ok(settlementRow(found)) : notFound('final settlement')
  }),

  http.get(base('/final-settlements/:id/payslip'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const found = finalSettlements.find(String(params.id))
    if (!found) return notFound('final settlement')
    const slip = found.payslipId ? payslips.find(found.payslipId) : undefined
    return slip ? ok(slip) : notFound('payslip (this settlement has not been worked out yet)')
  }),

  http.post(base('/final-settlements/:id/recalculate'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const found = finalSettlements.find(String(params.id))
    if (!found) return notFound('final settlement')
    if (found.status === 'completed') {
      return conflict('This settlement is closed. It cannot be recalculated', 'FS_CLOSED')
    }
    const slip = settlementPayslip(found, found.payslipId)
    if (payslips.find(slip.id)) payslips.update(slip.id, slip)
    else payslips.insert(slip)
    const updated = { ...found, payslipId: slip.id }
    finalSettlements.update(found.id, updated)
    return ok(settlementRow(updated))
  }),

  http.post(base('/final-settlements/:id/close'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const found = finalSettlements.find(String(params.id))
    if (!found) return notFound('final settlement')
    const body = await readBody(request, z.object({ rowVersion: z.string(), fileId: id.nullish() }))
    if (!body.success) return rejected(body.error)
    if (body.data.rowVersion !== settlementVersion(found)) {
      return changedByOthers('final settlement')
    }
    if (found.status === 'completed')
      return conflict('This settlement is already closed', 'FS_CLOSED')
    if (!found.payslipId) {
      return conflict('Recalculate the settlement before closing it', 'FS_NOT_CALCULATED')
    }
    const slip = payslips.find(found.payslipId)
    if (slip) payslips.update(slip.id, { ...slip, status: 'released', releasedAt: now() })
    const updated: StoredFinalSettlement = {
      ...found,
      status: 'completed',
      closedAt: now(),
      fileId: body.data.fileId ?? found.fileId ?? null,
    }
    finalSettlements.update(found.id, updated)
    return ok(settlementRow(updated))
  }),
]

// --- Opening balances ----------------------------------------------------------------------------------

const balanceInput = z.object({
  employeeId,
  balanceMonth: isoDay,
  payItemId: id,
  amount: z.number({ error: 'Enter the amount' }).refine((value) => value !== 0, {
    message: 'The amount cannot be zero.',
  }),
  isTaxable: z.boolean().default(false),
  kind: z.enum(['opening', 'adjustment']).default('opening'),
  description: z.string().max(2000).nullish(),
  rowVersion,
})

function summaries(url: URL): OpeningBalanceRow[] {
  const wantedMonth = param(url, 'month')
  const byPerson = new Map<string, OpeningBalanceEntry[]>()
  for (const entry of openingBalances.all()) {
    if (wantedMonth && entry.balanceMonth !== monthStart(wantedMonth)) continue
    byPerson.set(entry.employeeId, [...(byPerson.get(entry.employeeId) ?? []), entry])
  }
  return [...byPerson.entries()].map(([employee, entries]) => {
    const fields = personFields(employee)
    return {
      employeeId: employee,
      employeeCode: fields.employeeCode,
      employeeName: fields.employeeName,
      departmentName: fields.departmentName,
      netAmount: entries.reduce((sum, entry) => sum + entry.amount, 0),
      entryCount: entries.length,
      lastMonth:
        entries
          .map((entry) => entry.balanceMonth)
          .sort()
          .at(-1) ?? null,
    }
  })
}

const balanceHandlers = [
  http.get(base('/opening-balances'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const url = new URL(request.url)
    const list = searched(url, summaries(url), personText)
      .filter(
        (row) =>
          personMatches(url, row.employeeId) &&
          between(row.netAmount, numberParam(url, 'netFrom'), numberParam(url, 'netTo')),
      )
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
    return page(url, list)
  }),

  http.get(base('/opening-balances/employees/:employeeId'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const employee = String(params.employeeId)
    if (!findEmployee(employee)) return notFound('employee')
    const fields = personFields(employee)
    const detail: OpeningBalanceDetail = {
      employeeId: employee,
      employeeCode: fields.employeeCode,
      employeeName: fields.employeeName,
      departmentName: fields.departmentName,
      jobTitleName: fields.jobTitleName,
      locationName: fields.locationName,
      branchName: fields.branchName,
      entries: openingBalances
        .all()
        .filter((entry) => entry.employeeId === employee)
        .sort((a, b) => a.balanceMonth.localeCompare(b.balanceMonth))
        .map((entry) => ({ ...entry, employeeCode: null, employeeName: null })),
    }
    return ok(detail)
  }),

  http.post(base('/opening-balances/import'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const read = await importRows(request)
    if (read.error) return read.error
    const result: ImportResult = { created: 0, errors: [] }
    read.rows.forEach((row, index) => {
      const employee = employeeByCode(row.employeecode ?? '')
      const item = payItems
        .all()
        .find((candidate) => candidate.name.toLowerCase() === (row.payitem ?? '').toLowerCase())
      const balanceMonth = toMonth(row.month)
      const amount = toAmount(row.amount)
      const problem = !employee
        ? 'Employee code not found.'
        : !item
          ? 'Pay item not found.'
          : !balanceMonth
            ? 'Month is not valid.'
            : !Number.isFinite(amount) || amount === 0
              ? 'Amount is not valid.'
              : null
      if (problem || !employee || !item || !balanceMonth) {
        result.errors.push(`Row ${String(index + 1)}: ${problem ?? 'Not valid.'}`)
        return
      }
      const fields = personFields(employee.id)
      openingBalances.insert({
        id: createId('ob'),
        employeeId: employee.id,
        employeeCode: fields.employeeCode,
        employeeName: fields.employeeName,
        balanceMonth,
        payItemId: item.id,
        payItemName: item.name,
        itemType: item.itemType,
        amount,
        isTaxable: /^(yes|true|1|y)$/i.test(row.taxable ?? ''),
        kind: 'opening',
        description: blankToNull(row.description),
        isLocked: false,
        createdAt: now(),
        updatedAt: null,
        rowVersion: nextRowVersion(),
      })
      result.created += 1
    })
    return ok(result)
  }),

  http.get(base('/opening-balances/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const found = openingBalances.find(String(params.id))
    return found ? ok(found) : notFound('opening balance')
  }),

  ...(['post', 'put'] as const).map((method) =>
    http[method](
      base(method === 'post' ? '/opening-balances' : '/opening-balances/:id'),
      async ({ request, params }) => {
        const denied = await authed(request)
        if (denied) return denied
        const body = await readBody(request, balanceInput)
        if (!body.success) return rejected(body.error)
        const input = body.data
        const current = method === 'put' ? openingBalances.find(String(params.id)) : undefined
        if (method === 'put' && !current) return notFound('opening balance')
        if (current && stale(input.rowVersion, current.rowVersion)) {
          return changedByOthers('opening balance')
        }
        if (current?.isLocked) {
          return conflict('This month is closed in payroll. It cannot be changed', 'LOCKED')
        }
        const item = payItems.find(input.payItemId)
        const known = openingBalances.all().find((entry) => entry.payItemId === input.payItemId)
        if (!item && !known)
          return invalid('Choose the pay item.', { payItemId: 'Choose the pay item.' })
        const fields = personFields(input.employeeId)
        const row: OpeningBalanceEntry = {
          ...(current ?? { id: createId('ob'), createdAt: now(), isLocked: false }),
          employeeId: input.employeeId,
          employeeCode: fields.employeeCode,
          employeeName: fields.employeeName,
          balanceMonth: monthStart(input.balanceMonth),
          payItemId: input.payItemId,
          payItemName: item?.name ?? known?.payItemName ?? '',
          itemType: item?.itemType ?? known?.itemType ?? 'earning',
          amount: input.amount,
          isTaxable: input.isTaxable,
          kind: input.kind,
          description: input.description ?? null,
          ...stamp(),
          ...(current ? {} : { updatedAt: null }),
        }
        if (current) openingBalances.update(row.id, row)
        else openingBalances.insert(row)
        return HttpResponse.json({ data: row }, { status: current ? 200 : 201 })
      },
    ),
  ),

  http.delete(base('/opening-balances/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const found = openingBalances.find(String(params.id))
    if (!found) return notFound('opening balance')
    if (stale(param(new URL(request.url), 'rowVersion'), found.rowVersion)) {
      return changedByOthers('opening balance')
    }
    if (found.isLocked)
      return conflict('This month is closed in payroll. It cannot be changed', 'LOCKED')
    openingBalances.remove(found.id)
    return new HttpResponse(null, { status: 204 })
  }),
]

// --- Employee accounts, statement ----------------------------------------------------------------------

const accountInput = z.object({
  employeeId,
  accountTypeId: id,
  entryMonth: isoDay,
  direction: z.enum(['credit', 'debit']),
  amount: z.number({ error: 'Enter the amount' }).gt(0, 'Input should be greater than 0'),
  isProcessed: z.boolean().default(false),
  description: z.string().max(2000).nullish(),
  rowVersion,
})

/** Account fields from the settings store, or from an entry that already uses the account. */
function accountOf(accountTypeId: string) {
  const type = accountTypes.find(accountTypeId)
  if (type) return { accountName: type.name, accountCategory: type.category }
  const used = accountEntries.all().find((entry) => entry.accountTypeId === accountTypeId)
  return used ? { accountName: used.accountName, accountCategory: used.accountCategory } : null
}

function accountByName(name: string) {
  const type = accountTypes.all().find((item) => item.name.toLowerCase() === name.toLowerCase())
  if (type)
    return { accountTypeId: type.id, accountName: type.name, accountCategory: type.category }
  const used = accountEntries
    .all()
    .find((entry) => entry.accountName.toLowerCase() === name.toLowerCase())
  return used
    ? {
        accountTypeId: used.accountTypeId,
        accountName: used.accountName,
        accountCategory: used.accountCategory,
      }
    : null
}

const accountHandlers = [
  http.get(base('/employee-accounts'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const url = new URL(request.url)
    const scope = param(url, 'scope')
    const accountTypeId = param(url, 'accountTypeId')
    const wantedMonth = param(url, 'month')
    const list = searched(
      url,
      accountEntries.all(),
      (row) => `${personText(row)} ${row.accountName}`,
    )
      .filter(
        (row) =>
          (scope !== 'my' || row.employeeId === ME) &&
          personMatches(url, row.employeeId) &&
          (!accountTypeId || row.accountTypeId === accountTypeId) &&
          (!wantedMonth || row.entryMonth === monthStart(wantedMonth)),
      )
      .sort((a, b) => b.entryMonth.localeCompare(a.entryMonth) || b.id.localeCompare(a.id))
    return page(url, list)
  }),

  http.post(base('/employee-accounts/import'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const read = await importRows(request)
    if (read.error) return read.error
    const result: ImportResult = { created: 0, errors: [] }
    read.rows.forEach((row, index) => {
      const employee = employeeByCode(row.employeecode ?? '')
      const account = accountByName(row.account ?? '')
      const entryMonth = toMonth(row.month)
      const credit = toAmount(blankToNull(row.credit) ?? '0')
      const debit = toAmount(blankToNull(row.debit) ?? '0')
      const problem = !employee
        ? 'Employee code not found.'
        : !account
          ? 'Account not found.'
          : !entryMonth
            ? 'Month is not valid.'
            : !Number.isFinite(credit) || !Number.isFinite(debit) || credit + debit <= 0
              ? 'Give a credit or a debit.'
              : null
      if (problem || !employee || !account || !entryMonth) {
        result.errors.push(`Row ${String(index + 1)}: ${problem ?? 'Not valid.'}`)
        return
      }
      const fields = personFields(employee.id)
      accountEntries.insert({
        id: createId('ae'),
        employeeId: employee.id,
        employeeCode: fields.employeeCode,
        employeeName: fields.employeeName,
        ...account,
        entryMonth,
        credit,
        debit,
        isProcessed: false,
        payslipId: null,
        payRuleId: null,
        payRuleName: null,
        description: blankToNull(row.description),
        createdAt: now(),
        updatedAt: null,
        rowVersion: nextRowVersion(),
      })
      result.created += 1
    })
    return ok(result)
  }),

  http.get(base('/employee-accounts/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const found = accountEntries.find(String(params.id))
    return found ? ok(found) : notFound('employee account entry')
  }),

  ...(['post', 'put'] as const).map((method) =>
    http[method](
      base(method === 'post' ? '/employee-accounts' : '/employee-accounts/:id'),
      async ({ request, params }) => {
        const denied = await authed(request)
        if (denied) return denied
        const body = await readBody(request, accountInput)
        if (!body.success) return rejected(body.error)
        const input = body.data
        const current = method === 'put' ? accountEntries.find(String(params.id)) : undefined
        if (method === 'put' && !current) return notFound('employee account entry')
        if (current && stale(input.rowVersion, current.rowVersion)) {
          return changedByOthers('employee account entry')
        }
        const account = accountOf(input.accountTypeId)
        if (!account)
          return invalid('Choose the account.', { accountTypeId: 'Choose the account.' })
        const fields = personFields(input.employeeId)
        const row: EmployeeAccountRow = {
          ...(current ?? {
            id: createId('ae'),
            createdAt: now(),
            payslipId: null,
            payRuleId: null,
            payRuleName: null,
          }),
          employeeId: input.employeeId,
          employeeCode: fields.employeeCode,
          employeeName: fields.employeeName,
          accountTypeId: input.accountTypeId,
          ...account,
          entryMonth: monthStart(input.entryMonth),
          credit: input.direction === 'credit' ? input.amount : 0,
          debit: input.direction === 'debit' ? input.amount : 0,
          isProcessed: input.isProcessed,
          description: input.description ?? null,
          ...stamp(),
          ...(current ? {} : { updatedAt: null }),
        }
        if (current) accountEntries.update(row.id, row)
        else accountEntries.insert(row)
        return HttpResponse.json({ data: row }, { status: current ? 200 : 201 })
      },
    ),
  ),

  http.delete(base('/employee-accounts/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const found = accountEntries.find(String(params.id))
    if (!found) return notFound('employee account entry')
    if (stale(param(new URL(request.url), 'rowVersion'), found.rowVersion)) {
      return changedByOthers('employee account entry')
    }
    accountEntries.remove(found.id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(base('/account-statement'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const url = new URL(request.url)
    const wanted = param(url, 'employeeId')
    const accountTypeId = param(url, 'accountTypeId')
    const from = param(url, 'from')
    const to = param(url, 'to')
    const ordered = accountEntries
      .all()
      .filter(
        (row) =>
          (!wanted || row.employeeId === wanted) &&
          (!accountTypeId || row.accountTypeId === accountTypeId),
      )
      .sort(
        (a, b) =>
          a.employeeName.localeCompare(b.employeeName) ||
          a.accountName.localeCompare(b.accountName) ||
          a.entryMonth.localeCompare(b.entryMonth) ||
          a.createdAt.localeCompare(b.createdAt),
      )
    // The running balance counts every earlier entry, also those before `from`.
    const running = new Map<string, number>()
    const lines: AccountStatementRow[] = []
    for (const row of ordered) {
      const slot = `${row.employeeId}:${row.accountTypeId}`
      const balance = (running.get(slot) ?? 0) + row.credit - row.debit
      running.set(slot, balance)
      if (from && row.entryMonth < monthStart(from)) continue
      if (to && row.entryMonth > monthStart(to)) continue
      lines.push({
        id: row.id,
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        accountTypeId: row.accountTypeId,
        accountName: row.accountName,
        entryMonth: row.entryMonth,
        credit: row.credit,
        debit: row.debit,
        isProcessed: row.isProcessed,
        description: row.description,
        balance,
      })
    }
    return page(url, lines)
  }),
]

// --- Salary revision ---------------------------------------------------------------------------------

/** The revision's row version: changes whenever what it says changes. */
const revisionVersion = (revision: StoredSalaryRevision) =>
  `sr-${revision.effectiveDate}-${String(revision.salary)}-${String(revision.percentage)}`

function revisionRow(revision: StoredSalaryRevision): SalaryRevisionRow {
  const fields = personFields(revision.employeeId)
  return {
    id: revision.id,
    employeeId: revision.employeeId,
    employeeCode: fields.employeeCode,
    employeeName: fields.employeeName,
    effectiveDate: revision.effectiveDate,
    previousAmount: revision.previousSalary,
    amount: revision.salary,
    changeType: revision.type === 'percentage' ? 'percent' : 'flat',
    changeValue:
      revision.type === 'percentage'
        ? revision.percentage
        : revision.salary - revision.previousSalary,
    source: 'revision',
    canEdit: true,
    departmentName: fields.departmentName,
    locationName: fields.locationName,
    branchName: fields.branchName,
    jobTitleName: fields.jobTitleName,
    joiningDate: fields.joiningDate,
    createdAt: `${revision.effectiveDate}T00:00:00`,
    updatedAt: null,
    rowVersion: revisionVersion(revision),
  }
}

const dayBefore = (date: string) => format(subDays(parseISO(date), 1), 'yyyy-MM-dd')

const revisionInput = z.object({
  employeeId,
  effectiveDate: isoDay,
  changeType: z.enum(['flat', 'percent']),
  changeValue: z.number({ error: 'Enter the change' }).refine((value) => value !== 0, {
    message: 'The change cannot be zero.',
  }),
  rowVersion,
})

function revised(previous: number, changeType: 'flat' | 'percent', changeValue: number) {
  return changeType === 'flat'
    ? Math.round((previous + changeValue) * 100) / 100
    : Math.round(previous * (1 + changeValue / 100) * 100) / 100
}

const revisionHandlers = [
  http.get(base('/salary-revisions'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const url = new URL(request.url)
    const from = param(url, 'from')
    const to = param(url, 'to')
    const list = searched(url, salaryRevisions.all().map(revisionRow), personText)
      .filter(
        (row) =>
          personMatches(url, row.employeeId) &&
          (!from || row.effectiveDate >= from) &&
          (!to || row.effectiveDate <= to) &&
          between(row.amount, numberParam(url, 'salaryFrom'), numberParam(url, 'salaryTo')),
      )
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
    return page(url, list)
  }),

  http.get(base('/salary-revisions/current/:employeeId'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const employee = String(params.employeeId)
    if (!findEmployee(employee)) return notFound('employee')
    const asOf = param(new URL(request.url), 'date') ?? format(new Date(), 'yyyy-MM-dd')
    const fields = personFields(employee)
    const latest = salaryRevisions
      .all()
      .filter((item) => item.employeeId === employee && item.effectiveDate <= asOf)
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0]
    const current: CurrentSalary = {
      employeeId: employee,
      employeeCode: fields.employeeCode,
      employeeName: fields.employeeName,
      departmentName: fields.departmentName,
      jobTitleName: fields.jobTitleName,
      joiningDate: fields.joiningDate,
      salary: salaryOn(employee, asOf),
      effectiveDate: latest?.effectiveDate ?? fields.joiningDate,
    }
    return ok(current)
  }),

  http.post(base('/salary-revisions/import'), async ({ request }) => {
    const denied = await authed(request)
    if (denied) return denied
    const read = await importRows(request)
    if (read.error) return read.error
    const result: ImportResult = { created: 0, errors: [] }
    read.rows.forEach((row, index) => {
      const employee = employeeByCode(row.employeecode ?? '')
      const effectiveDate = row.effectivedate ?? ''
      const salary = toAmount(row.salary)
      const problem = !employee
        ? 'Employee code not found.'
        : !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)
          ? 'effective_date: Input should be a valid date'
          : !Number.isFinite(salary) || salary <= 0
            ? 'salary: Input should be greater than 0'
            : salaryRevisions
                  .all()
                  .some(
                    (item) =>
                      item.employeeId === employee.id && item.effectiveDate === effectiveDate,
                  )
              ? 'A revision on that date already exists.'
              : null
      if (problem || !employee) {
        result.errors.push(`Row ${String(index + 1)}: ${problem ?? 'Not valid.'}`)
        return
      }
      salaryRevisions.insert({
        id: createId('sr'),
        code: nextCode(
          'SR-',
          salaryRevisions.all().map((item) => item.code),
        ),
        employeeId: employee.id,
        effectiveDate,
        type: 'flat',
        percentage: null,
        previousSalary: salaryOn(employee.id, dayBefore(effectiveDate)),
        salary,
      })
      result.created += 1
    })
    return ok(result)
  }),

  http.get(base('/salary-revisions/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const found = salaryRevisions.find(String(params.id))
    return found ? ok(revisionRow(found)) : notFound('salary revision')
  }),

  ...(['post', 'put'] as const).map((method) =>
    http[method](
      base(method === 'post' ? '/salary-revisions' : '/salary-revisions/:id'),
      async ({ request, params }) => {
        const denied = await authed(request)
        if (denied) return denied
        const body = await readBody(request, revisionInput)
        if (!body.success) return rejected(body.error)
        const input = body.data
        const current = method === 'put' ? salaryRevisions.find(String(params.id)) : undefined
        if (method === 'put' && !current) return notFound('salary revision')
        if (current && stale(input.rowVersion, revisionVersion(current))) {
          return changedByOthers('salary revision')
        }
        if (input.changeType === 'percent' && input.changeValue <= -100) {
          return invalid('A percentage cut cannot be 100% or more.', {
            changeValue: 'A percentage cut cannot be 100% or more.',
          })
        }
        const clash = salaryRevisions
          .all()
          .some(
            (item) =>
              item.employeeId === input.employeeId &&
              item.effectiveDate === input.effectiveDate &&
              item.id !== current?.id,
          )
        if (clash) {
          return conflict('This person already has a salary from that date.', 'DUPLICATE', {
            effectiveDate: 'This person already has a salary from that date.',
          })
        }
        const previous = salaryOn(input.employeeId, dayBefore(input.effectiveDate))
        const revision: StoredSalaryRevision = {
          id: current?.id ?? createId('sr'),
          code:
            current?.code ??
            nextCode(
              'SR-',
              salaryRevisions.all().map((item) => item.code),
            ),
          employeeId: input.employeeId,
          effectiveDate: input.effectiveDate,
          type: input.changeType === 'percent' ? 'percentage' : 'flat',
          percentage: input.changeType === 'percent' ? input.changeValue : null,
          previousSalary: previous,
          salary: revised(previous, input.changeType, input.changeValue),
        }
        if (current) salaryRevisions.update(revision.id, revision)
        else salaryRevisions.insert(revision)
        return HttpResponse.json({ data: revisionRow(revision) }, { status: current ? 200 : 201 })
      },
    ),
  ),

  http.delete(base('/salary-revisions/:id'), async ({ request, params }) => {
    const denied = await authed(request)
    if (denied) return denied
    const found = salaryRevisions.find(String(params.id))
    if (!found) return notFound('salary revision')
    if (stale(param(new URL(request.url), 'rowVersion'), revisionVersion(found))) {
      return changedByOthers('salary revision')
    }
    salaryRevisions.remove(found.id)
    return new HttpResponse(null, { status: 204 })
  }),
]

export const payrollRecordHandlers = [
  ...voucherHandlers,
  ...settlementHandlers,
  ...balanceHandlers,
  ...accountHandlers,
  ...revisionHandlers,
]
