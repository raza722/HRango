import { format, subDays, subMonths } from 'date-fns'

import type {
  EmployeeAccountRow,
  LeaveEncashmentDetail,
  LeaveEncashmentRow,
  OpeningBalanceEntry,
  VoucherRow,
} from '@/features/payroll'

import { toProfile } from '../attendance/seed'
import { findEmployee } from '../employees/seed'

// Seeds for vouchers, balances and leave encashments, in the API's shapes.
// Pay item and account type ids follow the settings seed (`pi_…`, `at_…`); the
// names are copied so the rows read well even before the settings mock is seeded.

// Not from ./people: that module reads db-records, which these seeds fill (an import cycle).
function personFields(id: string) {
  const employee = findEmployee(id)
  const profile = employee ? toProfile(employee) : null
  return {
    employeeId: id,
    employeeCode: profile?.code ?? id,
    employeeName: employee?.name ?? 'Unknown',
    departmentName: employee?.department ?? null,
    designationName: employee?.jobTitle ?? null,
  }
}
const stampDaysAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 19)

const monthStart = (back: number) => format(subMonths(new Date(), back), 'yyyy-MM-01')
const day = (back: number) => format(subDays(new Date(), back), 'yyyy-MM-dd')
const stamped = (back: number, version: string) => ({
  createdAt: stampDaysAgo(back),
  updatedAt: null,
  rowVersion: version,
})

const person = (id: string) => {
  const fields = personFields(id)
  return {
    employeeId: fields.employeeId,
    employeeCode: fields.employeeCode,
    employeeName: fields.employeeName,
  }
}

function voucher(
  id: string,
  voucherNo: string,
  employeeId: string,
  extra: Partial<VoucherRow> & Pick<VoucherRow, 'voucherType' | 'amount' | 'status'>,
): VoucherRow {
  const fields = personFields(employeeId)
  return {
    id,
    voucherNo,
    ...person(employeeId),
    departmentName: fields.departmentName,
    designationName: fields.designationName,
    voucherDate: day(10),
    currency: 'PKR',
    paymentMethod: 'bank_transfer',
    purpose: null,
    notes: null,
    fileId: null,
    file: null,
    payrollId: null,
    payrollName: null,
    requestedById: null,
    requestedByName: null,
    approvedById: null,
    approvedByName: null,
    approvedAt: null,
    verifiedById: null,
    verifiedByName: null,
    verifiedAt: null,
    remarks: null,
    ...stamped(10, `v-${id}-1`),
    ...extra,
  }
}

export function seedVouchers(): VoucherRow[] {
  return [
    voucher('vc_1', 'VCH-00001', 'em_saad', {
      voucherType: 'expense_reimbursement',
      amount: 50_000,
      status: 'pending',
      purpose: 'Client visit to Karachi',
      requestedById: 'em_saad',
      requestedByName: personFields('em_saad').employeeName,
    }),
    voucher('vc_2', 'VCH-00002', 'em_omar', {
      voucherType: 'salary_advance',
      amount: 80_000,
      status: 'approved',
      purpose: 'Advance against salary',
      approvedById: 'em_shelley',
      approvedByName: personFields('em_shelley').employeeName,
      approvedAt: `${day(5)}T10:00:00`,
    }),
    voucher('vc_3', 'VCH-00003', 'em_kashif', {
      voucherType: 'daily_wage',
      amount: 4_200,
      status: 'processed',
      paymentMethod: 'cash',
      purpose: 'Daily wages',
      verifiedById: 'em_hina',
      verifiedByName: personFields('em_hina').employeeName,
      verifiedAt: `${day(4)}T12:00:00`,
    }),
    // The manual leave encashments' lines, one per person (VCH-00004 on).
    ...seedLeaveEncashments()
      .filter((encashment) => encashment.mode === 'manual')
      .flatMap((encashment) => encashment.employees.map((line) => ({ encashment, line })))
      .map(({ encashment, line }, index) =>
        encashmentVoucher(encashment, line, `VCH-${String(index + 4).padStart(5, '0')}`),
      ),
  ]
}

/** Where a manual encashment's voucher line for one person is kept (one per line). */
export const encashmentVoucherId = (encashmentId: string, employeeId: string) =>
  `vc_${encashmentId}_${employeeId}`

/** A manual leave encashment's voucher line: approved, paid out by Finance (Verify). */
export function encashmentVoucher(
  encashment: Pick<
    LeaveEncashmentDetail,
    'id' | 'leaveTypeName' | 'fiscalYear' | 'encashmentDate' | 'createdAt'
  >,
  line: Pick<LeaveEncashmentRow, 'employeeId' | 'days' | 'amount'>,
  voucherNo: string,
): VoucherRow {
  const fields = personFields(line.employeeId)
  return {
    ...voucher(encashmentVoucherId(encashment.id, line.employeeId), voucherNo, line.employeeId, {
      voucherType: 'leave_encashment',
      amount: line.amount,
      status: 'approved',
      paymentMethod: 'bank_transfer',
      purpose: `Leave encashment: ${String(line.days)} days of ${encashment.leaveTypeName}, ${String(encashment.fiscalYear)}`,
    }),
    departmentName: fields.departmentName,
    voucherDate: encashment.encashmentDate,
    createdAt: encashment.createdAt,
    rowVersion: `v-${encashment.id}-${line.employeeId}-1`,
  }
}

function entry(
  id: string,
  employeeId: string,
  payItemId: string,
  payItemName: string,
  amount: number,
  back: number,
  extra: Partial<OpeningBalanceEntry> = {},
): OpeningBalanceEntry {
  return {
    id,
    ...person(employeeId),
    balanceMonth: monthStart(back),
    payItemId,
    payItemName,
    itemType: 'earning',
    amount,
    isTaxable: false,
    kind: 'opening',
    description: null,
    isLocked: false,
    ...stamped(back * 30, `ob-${id}-1`),
    ...extra,
  }
}

export function seedOpeningBalances(): OpeningBalanceEntry[] {
  return [
    entry('ob_1', 'em_rehan', 'pi_travel', 'Travel Allowance', 12_000, 2, {
      description: 'Carried from the old payroll system',
      isLocked: true,
    }),
    entry('ob_2', 'em_rehan', 'pi_medical', 'Medical', 30_000, 1, { itemType: 'reimbursement' }),
    entry('ob_3', 'em_omer', 'pi_travel', 'Travel Allowance', 5_000, 1, { isTaxable: true }),
  ]
}

function account(
  id: string,
  employeeId: string,
  credit: number,
  debit: number,
  back: number,
  extra: Partial<EmployeeAccountRow> = {},
): EmployeeAccountRow {
  return {
    id,
    ...person(employeeId),
    accountTypeId: 'at_pf',
    accountName: 'Provident Fund',
    accountCategory: 'custom_pay_item',
    entryMonth: monthStart(back),
    credit,
    debit,
    isProcessed: back > 1,
    payslipId: null,
    payRuleId: null,
    payRuleName: null,
    description: null,
    ...stamped(back * 30, `ae-${id}-1`),
    ...extra,
  }
}

export function seedAccountEntries(): EmployeeAccountRow[] {
  return [
    account('ae_1', 'em_rehan', 8_500, 0, 3),
    account('ae_2', 'em_rehan', 8_500, 0, 2),
    account('ae_3', 'em_rehan', 0, 2_000, 1, { description: 'Withdrawal' }),
    account('ae_4', 'em_omer', 6_000, 0, 2),
  ]
}

function line(
  encashment: Omit<LeaveEncashmentDetail, 'employees'>,
  employeeId: string,
  days: number,
): LeaveEncashmentRow {
  return {
    id: `${encashment.id}:${employeeId}`,
    leaveEncashmentId: encashment.id,
    leaveTypeId: encashment.leaveTypeId,
    leaveTypeName: encashment.leaveTypeName,
    ...person(employeeId),
    fiscalYear: encashment.fiscalYear,
    encashmentDate: encashment.encashmentDate,
    basis: encashment.basis,
    mode: encashment.mode,
    amountPerLeave: encashment.amountPerLeave,
    days,
    amount: days * encashment.amountPerLeave,
    payslipId: null,
    isPaid: encashment.isPaid,
    rowVersion: encashment.rowVersion,
  }
}

export function encashmentWithLines(
  head: Omit<LeaveEncashmentDetail, 'employees' | 'totalDays' | 'totalAmount'>,
  lines: readonly (readonly [string, number])[],
): LeaveEncashmentDetail {
  const base = { ...head, totalDays: null, totalAmount: null }
  const employees = lines.map(([employeeId, days]) => line(base, employeeId, days))
  return {
    ...base,
    employees,
    totalDays: employees.reduce((sum, item) => sum + item.days, 0),
    totalAmount: employees.reduce((sum, item) => sum + item.amount, 0),
  }
}

export function seedLeaveEncashments(): LeaveEncashmentDetail[] {
  const year = new Date().getFullYear()
  return [
    encashmentWithLines(
      {
        id: 'le_1',
        leaveTypeId: 'lt_sick',
        leaveTypeName: 'Sick Leave',
        fiscalYear: year,
        encashmentDate: day(20),
        appliesToAll: false,
        basis: 'earned_salary',
        amountPerLeave: 4_000,
        mode: 'payroll',
        isPaid: false,
        ...stamped(20, 'le-le_1-1'),
      },
      [['em_omer', 5]],
    ),
    encashmentWithLines(
      {
        id: 'le_2',
        leaveTypeId: 'lt_casual',
        leaveTypeName: 'Casual Leaves',
        fiscalYear: year,
        encashmentDate: day(12),
        appliesToAll: false,
        basis: 'earned_salary',
        amountPerLeave: 5_500,
        mode: 'manual',
        isPaid: false,
        ...stamped(12, 'le-le_2-1'),
      },
      [
        ['em_haroon', 10],
        ['em_fatima', 6],
      ],
    ),
  ]
}
