import { format, getDaysInMonth, parse } from 'date-fns'

import type {
  PayItem,
  PayItemType,
  PayrollPayItemRow,
  PayslipDetail,
  PayslipLine,
  TaxStructure,
  TimeSlotOption,
} from '@/features/payroll'

import { rosterGroups } from '../roster/handlers'
import type { StoredPayroll, StoredPayslip } from './db-runs'
import { taxStructures } from './db-settings'
import { personFields, salaryOn } from './people'
import { nextRowVersion } from './people'

// A small stand-in for the API's payroll engine (the server calculates; this only gives the
// mock believable numbers): salary from the latest revision, tax from the payroll's tax
// structure, and the hand-edited lines kept on a rerun.

// Other features' mocks import the people helpers from here.
export { employeeProfile, employeeRef, isActive, salaryOn } from './people'

/** The pay item a line is for, when the settings store does not have it (empty in some tests). */
const FALLBACK_ITEMS: Record<
  'salary' | 'tax',
  Pick<PayItem, 'id' | 'name' | 'label' | 'itemType'>
> = {
  salary: { id: 'pi_salary', name: 'Salary', label: 'Gross Salary', itemType: 'earning' },
  tax: { id: 'pi_tax', name: 'Tax', label: 'Income Tax', itemType: 'deduction' },
}

/** The pay item rows a new payroll gets when none are chosen. */
export function defaultPayItemRows(items: readonly PayItem[]): PayrollPayItemRow[] {
  const list = items.length
    ? items
    : (Object.entries(FALLBACK_ITEMS).map(([code, item]) => ({
        ...item,
        systemCode: code,
        isTaxable: code === 'salary',
      })) as unknown as PayItem[])
  return list.map((item) => ({
    payItemId: item.id,
    payItemName: item.name,
    itemType: item.itemType,
    systemCode: item.systemCode,
    isTaxable: item.isTaxable,
    arrearApplicable: false,
    finalSettlement: true,
    calculateOnly: false,
  }))
}

/** Annual tax: the slab's fixed amount plus its rate on the part above its minimum. */
export function annualTax(income: number, structure: TaxStructure | undefined): number {
  if (!structure || income <= 0) return 0
  const slab = [...structure.slabs]
    .sort((a, b) => b.minAmount - a.minAmount)
    .find((item) => income >= item.minAmount)
  if (!slab) return 0
  let tax = slab.fixedAmount + ((income - slab.minAmount) * slab.percentage) / 100
  if (structure.surchargeType === 'percentage' && structure.surchargeValue) {
    tax += (tax * structure.surchargeValue) / 100
  } else if (structure.surchargeType === 'flat' && structure.surchargeValue) {
    tax += structure.surchargeValue
  }
  return Math.round(tax)
}

const round = (value: number) => Math.round(value * 100) / 100

function line(
  payItemId: string,
  name: string,
  itemType: PayItemType,
  amount: number,
  extra: Partial<PayslipLine> = {},
): PayslipLine {
  return {
    id: payItemId,
    payItemId,
    payItemName: name,
    payItemLabel: null,
    itemType,
    systemCode: null,
    amount: round(amount),
    employerContribution: null,
    isTaxable: false,
    isManuallyUpdated: false,
    isDisplayOnly: false,
    calculateOnly: false,
    ...extra,
  }
}

/** Totals from the lines (calculate-only and display-only lines are left out). */
export function withTotals<T extends PayslipDetail>(slip: T): T {
  const counted = slip.lines.filter((item) => !item.calculateOnly && !item.isDisplayOnly)
  const sum = (type: PayItemType) =>
    round(
      counted
        .filter((item) => item.itemType === type)
        .reduce((total, item) => total + item.amount, 0),
    )
  const totalEarnings = sum('earning')
  const totalDeductions = sum('deduction')
  const totalReimbursements = sum('reimbursement')
  const salary = slip.lines.find((item) => item.systemCode === 'salary')?.amount ?? totalEarnings
  const tax = slip.lines.find((item) => item.systemCode === 'tax')?.amount ?? 0
  return {
    ...slip,
    gross: salary,
    totalEarnings,
    totalDeductions,
    totalReimbursements,
    taxAmount: tax,
    taxableIncome: round(
      counted.filter((item) => item.isTaxable).reduce((total, item) => total + item.amount, 0),
    ),
    netPayable: round(totalEarnings + totalReimbursements - totalDeductions),
  }
}

export const payslipIdOf = (payrollId: string, employeeId: string) =>
  `ps_${payrollId}_${employeeId}`

const DISPLAY = {
  template: 'default',
  color: null,
  showSalaryBreakdown: true,
  hideAttendanceSummary: false,
  showEmployeePayItems: true,
  taxPositiveOnly: false,
  notesEnglish: null,
  notesOtherLanguage: null,
}

/**
 * One person's monthly payslip on a payroll: Salary, then Tax from the structure (a twelfth of
 * the year's tax on twelve months of taxable pay). Lines the person changed by hand are kept.
 */
export function computePayslip(
  payroll: StoredPayroll,
  employeeId: string,
  previous?: StoredPayslip,
): StoredPayslip {
  const month = payroll.payrollMonth ?? format(new Date(), 'yyyy-MM-01')
  const days = getDaysInMonth(parse(month, 'yyyy-MM-dd', new Date()))
  const monthEnd = `${month.slice(0, 8)}${String(days).padStart(2, '0')}`
  const salaryRow =
    payroll.payItems.find((item) => item.systemCode === 'salary') ??
    defaultPayItemRows([]).find((item) => item.systemCode === 'salary')
  const taxRow =
    payroll.payItems.find((item) => item.systemCode === 'tax') ??
    defaultPayItemRows([]).find((item) => item.systemCode === 'tax')
  const kept = new Map(
    (previous?.lines ?? [])
      .filter((item) => item.isManuallyUpdated)
      .map((item) => [item.payItemId, item]),
  )
  const salary = salaryOn(employeeId, monthEnd)
  const lines: PayslipLine[] = []
  if (salaryRow) {
    lines.push(
      kept.get(salaryRow.payItemId) ??
        line(salaryRow.payItemId, salaryRow.payItemName, 'earning', salary, {
          payItemLabel: 'Gross Salary',
          systemCode: 'salary',
          isTaxable: true,
        }),
    )
  }
  for (const item of kept.values()) {
    if (
      !lines.some((existing) => existing.payItemId === item.payItemId) &&
      item.systemCode !== 'tax'
    ) {
      lines.push(item)
    }
  }
  if (taxRow && payroll.taxApplicable) {
    const taxable = lines
      .filter((item) => item.isTaxable)
      .reduce((sum, item) => sum + item.amount, 0)
    const structure = payroll.taxStructureId
      ? taxStructures.find(payroll.taxStructureId)
      : undefined
    const tax = annualTax(taxable * 12, structure) / 12
    lines.push(
      kept.get(taxRow.payItemId) ??
        line(taxRow.payItemId, taxRow.payItemName, 'deduction', tax, {
          payItemLabel: 'Income Tax',
          systemCode: 'tax',
        }),
    )
  }
  const now = new Date().toISOString().slice(0, 19)
  return withTotals({
    ...personFields(employeeId),
    id: payslipIdOf(payroll.id, employeeId),
    payrollId: payroll.id,
    payrollCode: payroll.code,
    payrollName: payroll.name,
    payrollKind: payroll.kind,
    payrollStatus: payroll.status,
    payslipMonth: month,
    gross: null,
    totalEarnings: null,
    totalDeductions: null,
    totalReimbursements: null,
    netPayable: null,
    taxAmount: null,
    status: previous?.status === 'on_hold' ? 'on_hold' : 'ready',
    paymentMethod: payroll.disbursementBankId ? 'bank_transfer' : 'cash',
    releasedAt: null,
    paidAt: null,
    isFinalSettlement: false,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    rowVersion: nextRowVersion(),
    bankName: null,
    accountNumber: null,
    currency: payroll.currency,
    applicableDays: payroll.applicableDays === 'fixed' ? payroll.fixedDays : days,
    workedDays: payroll.applicableDays === 'fixed' ? payroll.fixedDays : days,
    workedMinutes: 0,
    expectedMinutes: 0,
    leaveDays: 0,
    absentDays: 0,
    overtimeMinutes: 0,
    taxableIncome: null,
    isManuallyUpdated: kept.size > 0,
    lines,
    display: DISPLAY,
    history: previous?.history ?? [],
  })
}

/** Daily-wage time slots: one per roster group, with its usual times. */
export function timeSlots(): TimeSlotOption[] {
  return rosterGroups
    .all()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((group, index) => {
      const first = group.days.find((day) => !day.isWeekend && day.clockIn && day.clockOut)
      return {
        id: group.id,
        code: `TS-${String(index + 1).padStart(4, '0')}`,
        name: group.title,
        startTime: `${group.clockIn ?? first?.clockIn ?? '09:00'}:00`,
        endTime: `${group.clockOut ?? first?.clockOut ?? '17:00'}:00`,
      }
    })
}

export const minutesOf = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** Minutes a slot spans (overnight slots wrap). */
export function slotMinutes(slot: TimeSlotOption) {
  const span = minutesOf(slot.endTime ?? '17:00') - minutesOf(slot.startTime ?? '09:00')
  return span <= 0 ? span + 24 * 60 : span
}

/** A day's wage: a thirtieth of the monthly salary. */
export const dayWage = (employeeId: string, date: string) => round(salaryOn(employeeId, date) / 30)

/** A payslip for a daily-wage run's person, worked out from the slot. */
export function dailyWageSlip(
  payroll: StoredPayroll,
  employeeId: string,
  wage: number,
): StoredPayslip {
  const day = payroll.workDate ?? format(new Date(), 'yyyy-MM-dd')
  const salaryItem = defaultPayItemRows([]).find((item) => item.systemCode === 'salary')
  const now = new Date().toISOString().slice(0, 19)
  return withTotals({
    ...personFields(employeeId),
    id: payslipIdOf(payroll.id, employeeId),
    payrollId: payroll.id,
    payrollCode: payroll.code,
    payrollName: payroll.name,
    payrollKind: 'daily_wage',
    payrollStatus: payroll.status,
    payslipMonth: `${day.slice(0, 7)}-01`,
    gross: null,
    totalEarnings: null,
    totalDeductions: null,
    totalReimbursements: null,
    netPayable: null,
    taxAmount: null,
    status: 'ready',
    paymentMethod: 'cash',
    releasedAt: null,
    paidAt: null,
    isFinalSettlement: false,
    createdAt: now,
    updatedAt: now,
    rowVersion: nextRowVersion(),
    bankName: null,
    accountNumber: null,
    currency: 'PKR',
    applicableDays: 1,
    workedDays: 1,
    workedMinutes: null,
    expectedMinutes: null,
    leaveDays: 0,
    absentDays: 0,
    overtimeMinutes: 0,
    taxableIncome: null,
    isManuallyUpdated: false,
    lines: [
      line(salaryItem?.payItemId ?? 'pi_salary', 'Daily Wage', 'earning', wage, {
        systemCode: 'salary',
        isTaxable: true,
      }),
    ],
    display: DISPLAY,
    history: [],
  })
}
