import { http } from 'msw'
import { z } from 'zod'

import {
  type AccountStatementRow,
  type EmployeeAccountReportRow,
  type EmployeeAccountRow,
  type EmployeeVoucher,
  type EmployeeVoucherRow,
  type ExpenseReportRow,
  type FinalSettlementRow,
  type OpeningBalance,
  type OpeningBalanceDetail,
  type OpeningBalanceRow,
  PAYMENT_METHODS,
  type SalaryRevision,
  type SalaryRevisionDetail,
  type SalaryRevisionRow,
  VOUCHER_STATUSES,
  VOUCHER_TYPE_LABELS,
  VOUCHER_TYPES,
  type VoucherRow,
} from '@/features/payroll'

import { DIRECTORY, findEmployee } from '../employees/seed'
import { branches } from '../settings/handlers'
import { createId, latency, requireAuth } from '../utils'
import {
  accountEntries,
  accountTypes,
  employeeVouchers,
  finalSettlements,
  openingBalances,
  payItems,
  payslips,
  salaryRevisions,
  taxRebates,
  vouchers,
} from './db'
import {
  employeeProfile,
  employeeRef,
  ensurePayrollRuns,
  isActive,
  salaryOn,
  settlementPayslip,
} from './engine'
import {
  base,
  between,
  conflict,
  day,
  invalid,
  money,
  month,
  nextCode,
  notFound,
  numberParam,
  ok,
  page,
  param,
  readBody,
  rejected,
} from './http'
import { payslipDetail } from './run-handlers'

const authed = async (request: Request) => {
  await latency()
  ensurePayrollRuns()
  return requireAuth(request)
}

const employeeId = z
  .string()
  .min(1, 'Choose the employee')
  .refine((id) => Boolean(findEmployee(id)), {
    message: 'Choose the employee',
  })

/** Filters every list shares: branch, location, department, employee, employment status. */
export function personMatches(url: URL, id: string): boolean {
  const employee = findEmployee(id)
  const branchId = param(url, 'branchId')
  const locationId = param(url, 'locationId')
  const department = param(url, 'department')
  const designation = param(url, 'designation')
  const wanted = param(url, 'employeeId')
  const status = param(url, 'employmentStatus')
  const code = (param(url, 'code') ?? '').toLowerCase()
  if (wanted && id !== wanted) return false
  if (branchId && employee?.branchId !== branchId) return false
  if (
    locationId &&
    (employee?.branchId ? branches.find(employee.branchId)?.locationId : null) !== locationId
  ) {
    return false
  }
  if (department && employee?.department !== department) return false
  if (designation && employee?.jobTitle !== designation) return false
  if (status === 'active' && !isActive(id)) return false
  if (status === 'inactive' && isActive(id)) return false
  if (code && !employeeRef(id).code.toLowerCase().includes(code)) return false
  return true
}

// --- Vouchers ----------------------------------------------------------------------------------

const voucherHandlers = [
  http.get(base('/vouchers'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const code = param(url, 'voucherCode')
    const type = (param(url, 'type') ?? '').toLowerCase()
    const date = param(url, 'date')
    const list = vouchers
      .all()
      .filter(
        (voucher) =>
          personMatches(url, voucher.employeeId) &&
          (!code || voucher.code.includes(code)) &&
          (!type || VOUCHER_TYPE_LABELS[voucher.type].toLowerCase().includes(type)) &&
          (!date || voucher.date === date) &&
          between(voucher.amount, numberParam(url, 'amountFrom'), numberParam(url, 'amountTo')),
      )
      .sort((a, b) => a.date.localeCompare(b.date))
    return page(
      url,
      list.map((voucher): VoucherRow => ({
        ...voucher,
        employee: employeeRef(voucher.employeeId),
      })),
    )
  }),
  http.delete(base('/vouchers/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    return vouchers.remove(String(params.id)) ? ok({ id: String(params.id) }) : notFound('voucher')
  }),
]

const employeeVoucherSchema = z
  .object({
    employeeId,
    voucherType: z.enum(VOUCHER_TYPES, { error: 'Choose the voucher type' }),
    voucherNo: z.string().trim().min(1, 'Enter the voucher number').max(40),
    voucherDate: day,
    amount: money.refine((value) => value > 0, { message: 'Enter the amount' }),
    paymentMethod: z.enum(PAYMENT_METHODS),
    purpose: z.string().trim().max(500),
    comments: z.string().trim().max(1000),
    attachmentName: z.string().max(200).nullable(),
    requestedById: employeeId,
    approvedById: z.string().min(1, 'Choose who approved it').nullable(),
    approvalDate: day.nullable(),
    verifiedBy: z.string().trim().min(1, 'Enter who verified it').max(80),
    verificationDate: day.nullable(),
    status: z.enum(VOUCHER_STATUSES),
  })
  .refine((value) => value.approvedById !== null, {
    message: 'Choose who approved it',
    path: ['approvedById'],
  })
  .refine((value) => value.approvalDate !== null, {
    message: 'Choose the approval date',
    path: ['approvalDate'],
  })

function employeeVoucherRow(item: EmployeeVoucher): EmployeeVoucherRow {
  return {
    ...item,
    employee: employeeRef(item.employeeId),
    requestedBy: employeeRef(item.requestedById),
    approvedBy: item.approvedById ? employeeRef(item.approvedById) : null,
  }
}

/** An employee voucher is paid like any other: it has a line on the Vouchers list. */
function syncVoucherLine(item: EmployeeVoucher) {
  const id = `vc_${item.id}`
  const line = {
    id,
    code: vouchers.find(id)?.code ?? String(55 + vouchers.all().length * 11),
    employeeId: item.employeeId,
    amount: item.amount,
    date: item.voucherDate,
    type: item.voucherType,
  }
  if (item.status === 'rejected') vouchers.remove(id)
  else if (vouchers.find(id)) vouchers.update(id, line)
  else vouchers.insert(line)
}

const employeeVoucherHandlers = [
  http.get(base('/employee-vouchers'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const list = employeeVouchers.all().filter((item) => personMatches(url, item.employeeId))
    return page(url, list.map(employeeVoucherRow))
  }),
  http.get(base('/employee-vouchers/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const item = employeeVouchers.find(String(params.id))
    return item ? ok(employeeVoucherRow(item)) : notFound('employee voucher')
  }),
  http.post(base('/employee-vouchers'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, employeeVoucherSchema)
    if (!parsed.success) return rejected(parsed.error)
    if (employeeVouchers.all().some((item) => item.voucherNo === parsed.data.voucherNo)) {
      return conflict('This voucher number is already used', 'DUPLICATE', {
        voucherNo: 'This voucher number is already used',
      })
    }
    const item = { id: createId('ev'), ...parsed.data }
    employeeVouchers.insert(item)
    syncVoucherLine(item)
    return ok(employeeVoucherRow(item))
  }),
  http.put(base('/employee-vouchers/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const existing = employeeVouchers.find(String(params.id))
    if (!existing) return notFound('employee voucher')
    const parsed = await readBody(request, employeeVoucherSchema)
    if (!parsed.success) return rejected(parsed.error)
    if (
      employeeVouchers
        .all()
        .some((item) => item.id !== existing.id && item.voucherNo === parsed.data.voucherNo)
    ) {
      return conflict('This voucher number is already used', 'DUPLICATE', {
        voucherNo: 'This voucher number is already used',
      })
    }
    const item = { ...existing, ...parsed.data }
    employeeVouchers.update(existing.id, item)
    syncVoucherLine(item)
    return ok(employeeVoucherRow(item))
  }),
  http.delete(base('/employee-vouchers/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const id = String(params.id)
    if (!employeeVouchers.remove(id)) return notFound('employee voucher')
    vouchers.remove(`vc_${id}`)
    return ok({ id })
  }),
]

// --- Final Settlement ---------------------------------------------------------------------------

const settlementRow = (id: string): FinalSettlementRow | undefined => {
  const item = finalSettlements.find(id)
  return item ? { ...item, employee: employeeRef(item.employeeId) } : undefined
}

function settle(id: string) {
  const item = finalSettlements.find(id)
  if (!item) return undefined
  const previous = item.payslipId ? payslips.find(item.payslipId) : undefined
  const result = settlementPayslip(item.employeeId, item.lastWorkingDate, previous)
  if ('error' in result) return result.error
  const slip = {
    ...result.payslip,
    id: previous?.id ?? `ps_fs_${item.employeeId}`,
    payrollId: 'fs',
    status: item.status === 'completed' ? ('released-fs' as const) : ('ready' as const),
  }
  if (payslips.find(slip.id)) payslips.update(slip.id, slip)
  else payslips.insert(slip)
  finalSettlements.update(item.id, { ...item, payslipId: slip.id })
  return slip
}

const finalSettlementHandlers = [
  http.get(base('/final-settlements'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const wantedMonth = param(url, 'month')
    const list = finalSettlements
      .all()
      .filter(
        (item) =>
          personMatches(url, item.employeeId) &&
          (!wantedMonth || item.lastWorkingDate.startsWith(wantedMonth)),
      )
      .map((item) => settlementRow(item.id))
      .filter((row): row is FinalSettlementRow => row !== undefined)
    return page(url, list)
  }),
  http.get(base('/final-settlements/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const row = settlementRow(String(params.id))
    return row
      ? ok({ ...row, profile: employeeProfile(row.employeeId) })
      : notFound('final settlement')
  }),
  http.get(base('/final-settlements/:id/payslip'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const item = finalSettlements.find(String(params.id))
    if (!item) return notFound('final settlement')
    const existing = item.payslipId ? payslips.find(item.payslipId) : undefined
    const slip = existing ?? settle(item.id)
    if (!slip) return notFound('final settlement')
    if ('message' in slip) return invalid(slip.message)
    return ok(payslipDetail(slip))
  }),
  http.post(base('/final-settlements/:id/recalculate'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const item = finalSettlements.find(String(params.id))
    if (!item) return notFound('final settlement')
    if (item.status === 'completed')
      return conflict('A closed final settlement cannot be recalculated.')
    const slip = settle(item.id)
    if (slip && 'message' in slip) return invalid(slip.message)
    return ok(settlementRow(item.id))
  }),
  http.post(base('/final-settlements/:id/close'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const item = finalSettlements.find(String(params.id))
    if (!item) return notFound('final settlement')
    if (item.status === 'completed') return conflict('This final settlement is already closed.')
    finalSettlements.update(item.id, { ...item, status: 'completed' })
    const slip = settle(item.id)
    if (slip && 'message' in slip) return invalid(slip.message)
    return ok(settlementRow(item.id))
  }),
]

// --- Balances → Opening Balance ------------------------------------------------------------------

const balanceTotal = (balance: OpeningBalance) =>
  balance.items.reduce((sum, item) => sum + item.amount, 0)

function balanceRow(balance: OpeningBalance): OpeningBalanceRow {
  return {
    id: balance.id,
    code: balance.code,
    employee: employeeRef(balance.employeeId),
    netAmount: balanceTotal(balance),
  }
}

function balanceDetail(balance: OpeningBalance): OpeningBalanceDetail {
  const ids = [...new Set(balance.items.map((item) => item.payItemId))]
  return {
    ...balanceRow(balance),
    profile: employeeProfile(balance.employeeId),
    groups: ids.map((payItemId) => ({
      payItemId,
      name: payItems.find(payItemId)?.name ?? payItemId,
      items: balance.items.filter((item) => item.payItemId === payItemId),
    })),
  }
}

const balanceItemSchema = z.object({
  employeeId,
  month,
  taxable: z.boolean(),
  payItemId: z.string().min(1, 'Choose the pay item'),
  amount: money.refine((value) => value > 0, { message: 'Enter the amount' }),
  description: z.string().trim().max(500),
})

function addBalanceItem(input: z.infer<typeof balanceItemSchema>): OpeningBalance {
  const existing = openingBalances.all().find((item) => item.employeeId === input.employeeId)
  const entry = {
    id: createId('obi'),
    payItemId: input.payItemId,
    month: input.month,
    amount: input.amount,
    taxable: input.taxable,
    description: input.description,
  }
  if (existing) {
    const next = { ...existing, items: [...existing.items, entry] }
    openingBalances.update(existing.id, next)
    return next
  }
  const created: OpeningBalance = {
    id: createId('ob'),
    code: nextCode(
      'RI-',
      openingBalances.all().map((item) => item.code),
    ),
    employeeId: input.employeeId,
    items: [entry],
  }
  openingBalances.insert(created)
  return created
}

const importRows = z.object({
  kind: z.enum(['opening-balance', 'provident-fund']),
  rows: z
    .array(
      z.object({
        employeeCode: z.string(),
        payItem: z.string(),
        month: z.string(),
        amount: z.number(),
        taxable: z.boolean(),
        description: z.string(),
      }),
    )
    .min(1, 'The file has no rows')
    .max(2000),
})

const openingBalanceHandlers = [
  http.get(base('/opening-balances'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const list = openingBalances
      .all()
      .filter(
        (balance) =>
          personMatches(url, balance.employeeId) &&
          (!param(url, 'balanceCode') ||
            balance.code.toLowerCase().includes((param(url, 'balanceCode') ?? '').toLowerCase())) &&
          between(balanceTotal(balance), numberParam(url, 'netFrom'), numberParam(url, 'netTo')),
      )
      .sort((a, b) => a.code.localeCompare(b.code))
    return page(url, list.map(balanceRow))
  }),
  http.get(base('/opening-balances/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const balance = openingBalances.find(String(params.id))
    return balance ? ok(balanceDetail(balance)) : notFound('opening balance')
  }),
  http.post(base('/opening-balances'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, balanceItemSchema)
    if (!parsed.success) return rejected(parsed.error)
    return ok(balanceRow(addBalanceItem(parsed.data)))
  }),
  http.post(base('/opening-balances/import'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, importRows)
    if (!parsed.success) return rejected(parsed.error)
    const errors: string[] = []
    let created = 0
    parsed.data.rows.forEach((row, index) => {
      const line = index + 2
      const employee = DIRECTORY.find(
        (person) =>
          employeeRef(person.id).code.toLowerCase() === row.employeeCode.trim().toLowerCase(),
      )
      const payItem =
        parsed.data.kind === 'provident-fund'
          ? payItems.find('pi_pf')
          : payItems
              .all()
              .find((item) => item.name.toLowerCase() === row.payItem.trim().toLowerCase())
      if (!employee) errors.push(`Line ${line}: no employee with code ${row.employeeCode}`)
      else if (!payItem) errors.push(`Line ${line}: no pay item called ${row.payItem}`)
      else if (!/^\d{4}-\d{2}$/.test(row.month))
        errors.push(`Line ${line}: the month must be yyyy-mm`)
      else if (!(row.amount > 0)) errors.push(`Line ${line}: the amount must be more than 0`)
      else {
        addBalanceItem({
          employeeId: employee.id,
          month: row.month,
          taxable: row.taxable,
          payItemId: payItem.id,
          amount: row.amount,
          description: row.description,
        })
        created += 1
      }
    })
    return ok({ created, errors })
  }),
]

// --- Balances → Employee Accounts, Statement ---------------------------------------------------

const accountName = (id: string) => accountTypes.find(id)?.name ?? '—'

const accountRow = (id: string): EmployeeAccountRow | undefined => {
  const entry = accountEntries.find(id)
  if (!entry) return undefined
  return {
    ...entry,
    employee: employeeRef(entry.employeeId),
    account: accountName(entry.accountTypeId),
    credit: entry.direction === 'credit' ? entry.amount : 0,
    debit: entry.direction === 'debit' ? entry.amount : 0,
  }
}

const accountSchema = z.object({
  employeeId,
  accountTypeId: z.string().min(1, 'Choose the account'),
  month,
  direction: z.enum(['credit', 'debit']),
  amount: money.refine((value) => value > 0, { message: 'Enter the amount' }),
  processed: z.boolean(),
})

const accountHandlers = [
  http.get(base('/employee-accounts'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const wanted = param(url, 'month')
    const list = accountEntries
      .all()
      .filter(
        (entry) => personMatches(url, entry.employeeId) && (!wanted || entry.month === wanted),
      )
      .sort((a, b) => b.month.localeCompare(a.month))
      .map((entry) => accountRow(entry.id))
      .filter((row): row is EmployeeAccountRow => row !== undefined)
    return page(url, list)
  }),
  http.get(base('/employee-accounts/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const row = accountRow(String(params.id))
    return row ? ok(row) : notFound('employee account entry')
  }),
  http.post(base('/employee-accounts'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, accountSchema)
    if (!parsed.success) return rejected(parsed.error)
    const entry = { id: createId('ae'), ...parsed.data }
    accountEntries.insert(entry)
    return ok(accountRow(entry.id))
  }),
  http.put(base('/employee-accounts/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const existing = accountEntries.find(String(params.id))
    if (!existing) return notFound('employee account entry')
    const parsed = await readBody(request, accountSchema)
    if (!parsed.success) return rejected(parsed.error)
    accountEntries.update(existing.id, { ...existing, ...parsed.data })
    return ok(accountRow(existing.id))
  }),
  http.post(base('/employee-accounts/import'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, importRows)
    if (!parsed.success) return rejected(parsed.error)
    const errors: string[] = []
    let created = 0
    parsed.data.rows.forEach((row, index) => {
      const line = index + 2
      const employee = DIRECTORY.find(
        (person) =>
          employeeRef(person.id).code.toLowerCase() === row.employeeCode.trim().toLowerCase(),
      )
      const account =
        parsed.data.kind === 'provident-fund'
          ? accountTypes.find('at_pf')
          : accountTypes
              .all()
              .find((item) => item.name.toLowerCase() === row.payItem.trim().toLowerCase())
      if (!employee) errors.push(`Line ${line}: no employee with code ${row.employeeCode}`)
      else if (!account) errors.push(`Line ${line}: no account called ${row.payItem}`)
      else if (!/^\d{4}-\d{2}$/.test(row.month))
        errors.push(`Line ${line}: the month must be yyyy-mm`)
      else if (row.amount === 0) errors.push(`Line ${line}: the amount cannot be 0`)
      else {
        accountEntries.insert({
          id: createId('ae'),
          employeeId: employee.id,
          accountTypeId: account.id,
          month: row.month,
          direction: row.amount > 0 ? 'credit' : 'debit',
          amount: Math.abs(row.amount),
          processed: true,
        })
        created += 1
      }
    })
    return ok({ created, errors })
  }),
  http.get(base('/account-statement'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const wanted = param(url, 'month')
    const grouped = new Map<string, AccountStatementRow>()
    for (const entry of accountEntries.all()) {
      if (!personMatches(url, entry.employeeId) || (wanted && entry.month !== wanted)) continue
      const key = `${entry.employeeId}|${entry.accountTypeId}|${entry.month}`
      const row = grouped.get(key) ?? {
        id: key,
        employee: employeeRef(entry.employeeId),
        account: accountName(entry.accountTypeId),
        accountTypeId: entry.accountTypeId,
        month: entry.month,
        credit: 0,
        debit: 0,
      }
      if (entry.direction === 'credit') row.credit += entry.amount
      else row.debit += entry.amount
      grouped.set(key, row)
    }
    const list = [...grouped.values()].sort(
      (a, b) => b.month.localeCompare(a.month) || a.employee.name.localeCompare(b.employee.name),
    )
    return page(url, list)
  }),
]

// --- Salary Revision ----------------------------------------------------------------------------

const revisionRow = (item: SalaryRevision): SalaryRevisionRow => ({
  ...item,
  employee: employeeRef(item.employeeId),
})

const revisionSchema = z
  .object({
    employeeId,
    effectiveDate: day,
    type: z.enum(['flat', 'percentage']),
    percentage: z.number().min(0.01, 'Enter the increase').max(500, 'Use at most 500%').nullable(),
    salary: money.refine((value) => value > 0, { message: 'Enter the salary' }),
  })
  .refine((value) => value.type === 'flat' || value.percentage !== null, {
    message: 'Enter the percentage increase',
    path: ['percentage'],
  })

const revisionHandlers = [
  http.get(base('/salary-revisions'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const from = param(url, 'from')
    const to = param(url, 'to')
    const list = salaryRevisions
      .all()
      .filter(
        (item) =>
          personMatches(url, item.employeeId) &&
          (!from || item.effectiveDate >= from) &&
          (!to || item.effectiveDate <= to),
      )
      .sort((a, b) => b.code.localeCompare(a.code))
    return page(url, list.map(revisionRow))
  }),
  http.get(base('/salary-revisions/current/:employeeId'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const id = String(params.employeeId)
    const date =
      new URL(request.url).searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
    return ok({ salary: salaryOn(id, date), profile: employeeProfile(id) })
  }),
  http.get(base('/salary-revisions/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const item = salaryRevisions.find(String(params.id))
    if (!item) return notFound('salary revision')
    const detail: SalaryRevisionDetail = {
      ...revisionRow(item),
      profile: employeeProfile(item.employeeId),
    }
    return ok(detail)
  }),
  http.post(base('/salary-revisions'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, revisionSchema)
    if (!parsed.success) return rejected(parsed.error)
    const clash = salaryRevisions
      .all()
      .some(
        (item) =>
          item.employeeId === parsed.data.employeeId &&
          item.effectiveDate === parsed.data.effectiveDate,
      )
    if (clash) {
      return conflict('This person already has a revision from that date', 'DUPLICATE', {
        effectiveDate: 'This person already has a revision from that date',
      })
    }
    const item: SalaryRevision = {
      id: createId('sr'),
      code: nextCode(
        'SR-',
        salaryRevisions.all().map((entry) => entry.code),
      ),
      ...parsed.data,
      percentage: parsed.data.type === 'percentage' ? parsed.data.percentage : null,
      previousSalary: salaryOn(parsed.data.employeeId, dayBefore(parsed.data.effectiveDate)),
    }
    salaryRevisions.insert(item)
    return ok(revisionRow(item))
  }),
  http.put(base('/salary-revisions/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const existing = salaryRevisions.find(String(params.id))
    if (!existing) return notFound('salary revision')
    const parsed = await readBody(request, revisionSchema)
    if (!parsed.success) return rejected(parsed.error)
    const item: SalaryRevision = {
      ...existing,
      ...parsed.data,
      employeeId: existing.employeeId,
      percentage: parsed.data.type === 'percentage' ? parsed.data.percentage : null,
    }
    salaryRevisions.update(existing.id, item)
    return ok(revisionRow(item))
  }),
  http.delete(base('/salary-revisions/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    return salaryRevisions.remove(String(params.id))
      ? ok({ id: String(params.id) })
      : notFound('salary revision')
  }),
  http.post(base('/salary-revisions/import'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(
      request,
      z.object({
        rows: z
          .array(
            z.object({ employeeCode: z.string(), effectiveDate: z.string(), salary: z.number() }),
          )
          .min(1, 'The file has no rows')
          .max(2000),
      }),
    )
    if (!parsed.success) return rejected(parsed.error)
    const errors: string[] = []
    let created = 0
    parsed.data.rows.forEach((row, index) => {
      const line = index + 2
      const employee = DIRECTORY.find(
        (person) =>
          employeeRef(person.id).code.toLowerCase() === row.employeeCode.trim().toLowerCase(),
      )
      if (!employee) errors.push(`Line ${line}: no employee with code ${row.employeeCode}`)
      else if (!/^\d{4}-\d{2}-\d{2}$/.test(row.effectiveDate))
        errors.push(`Line ${line}: the date must be yyyy-mm-dd`)
      else if (!(row.salary > 0)) errors.push(`Line ${line}: the salary must be more than 0`)
      else {
        salaryRevisions.insert({
          id: createId('sr'),
          code: nextCode(
            'SR-',
            salaryRevisions.all().map((entry) => entry.code),
          ),
          employeeId: employee.id,
          effectiveDate: row.effectiveDate,
          type: 'flat',
          percentage: null,
          previousSalary: salaryOn(employee.id, dayBefore(row.effectiveDate)),
          salary: row.salary,
        })
        created += 1
      }
    })
    return ok({ created, errors })
  }),
]

function dayBefore(date: string): string {
  const value = new Date(`${date}T00:00`)
  value.setDate(value.getDate() - 1)
  return value.toISOString().slice(0, 10)
}

// --- Reports, expense report -------------------------------------------------------------------

const reportHandlers = [
  http.get(base('/reports/employee-accounts'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const ids = new Set(payslips.all().map((slip) => slip.employeeId))
    const rows: EmployeeAccountReportRow[] = [...ids]
      .filter((id) => personMatches(url, id))
      .map((id) => {
        const slips = payslips
          .all()
          .filter((slip) => slip.employeeId === id && slip.status !== 'on-hold')
        const sum = (payItemId: string) =>
          slips.reduce(
            (total, slip) =>
              total + (slip.items.find((item) => item.payItemId === payItemId)?.value ?? 0),
            0,
          )
        return {
          employee: employeeRef(id),
          providentFund: sum('pi_pf'),
          totalTaxRebate: taxRebates
            .all()
            .filter((rebate) => rebate.employeeId === id)
            .reduce((total, rebate) => total + rebate.amount, 0),
          totalTaxPaid: sum('pi_tax'),
        }
      })
      .sort((a, b) => a.employee.name.localeCompare(b.employee.name))
    return page(url, rows)
  }),
  http.get(base('/dashboard/expenses'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const wanted = param(url, 'month') ?? new Date().toISOString().slice(0, 7)
    const rows: ExpenseReportRow[] = [
      ...vouchers
        .all()
        .filter((voucher) => voucher.date.startsWith(wanted) && voucher.type !== 'salary-advance')
        .map((voucher) => ({
          id: voucher.id,
          employee: employeeRef(voucher.employeeId),
          type: VOUCHER_TYPE_LABELS[voucher.type],
          amount: voucher.amount,
          date: voucher.date,
        })),
    ].sort((a, b) => b.date.localeCompare(a.date))
    return ok(rows)
  }),
]

export const payrollRecordHandlers = [
  ...voucherHandlers,
  ...employeeVoucherHandlers,
  ...finalSettlementHandlers,
  ...openingBalanceHandlers,
  ...accountHandlers,
  ...revisionHandlers,
  ...reportHandlers,
]
