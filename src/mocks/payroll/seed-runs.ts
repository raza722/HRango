import { format, subDays, subMonths } from 'date-fns'

import type { RunLog } from '@/features/payroll'

import { DIRECTORY } from '../employees/seed'
import { rosterGroups } from '../roster/handlers'
import { profileOf } from '../scheduling/seed'
import type { StoredPayroll } from './db-runs'
import { banks, payItems, taxStructures } from './db-settings'
import { defaultPayItemRows } from './engine'
import { isActive } from './people'

// The seeded runs: four monthly payrolls (Head Office running this month and closed last
// month, Software closed last month, Abdul on hold with one error) and two daily-wage runs.
// Their payslips are worked out on first use (run-handlers).

const monthStartOf = (date: Date) => format(date, 'yyyy-MM-01')
const stamp = (back: number, time = '11:22:00') =>
  `${format(subDays(new Date(), back), 'yyyy-MM-dd')}T${time}`

/** A recent working day. */
export function recentWorkday(back: number): string {
  let day = subDays(new Date(), back)
  while (day.getDay() === 0 || day.getDay() === 6) day = subDays(day, 1)
  return format(day, 'yyyy-MM-dd')
}

const activeIn = (branchIds: readonly string[]) =>
  DIRECTORY.filter(
    (employee) =>
      employee.branchId !== null && branchIds.includes(employee.branchId) && isActive(employee.id),
  ).map((employee) => employee.id)

const log = (id: string, kind: string, back: number, count: number): RunLog => ({
  id,
  kind,
  startedAt: stamp(back),
  finishedAt: stamp(back, '11:22:05'),
  status: 'completed',
  processedCount: count,
  errorCount: 0,
  runByUserId: 'u_shelley',
  runByName: 'Shelley Kannes',
})

export function seedPayrolls(): StoredPayroll[] {
  const items = defaultPayItemRows(payItems.all())
  const structure = taxStructures.find('tx_current') ?? taxStructures.all()[0]
  const bank = banks.find('bank_ubl') ?? banks.all()[0]
  const slot = rosterGroups.all()[0]
  const common = {
    kind: 'monthly' as const,
    workDate: null,
    timeSlotId: null,
    timeSlotName: null,
    currency: 'PKR',
    taxStructureId: structure?.id ?? null,
    taxStructureName: structure?.name ?? null,
    taxApplicable: true,
    processingMode: 'month_end' as const,
    applicableDays: 'actual' as const,
    fixedDays: null,
    disbursementBankId: bank?.id ?? null,
    disbursementBankName: bank?.bankName ?? null,
    closedByUserId: null,
    payslipCount: 0,
    totalEarnings: 0,
    totalDeductions: 0,
    netPayable: 0,
    payItems: items,
    createdAt: stamp(120),
    updatedAt: null,
  }
  const thisMonth = monthStartOf(new Date())
  const lastMonth = monthStartOf(subMonths(new Date(), 1))
  const monthly = (
    id: string,
    code: string,
    name: string,
    month: string,
    status: StoredPayroll['status'],
    branches: string[],
    description: string,
  ): StoredPayroll => {
    const employeeIds = activeIn(branches)
    const closed = status === 'closed'
    return {
      ...common,
      id,
      code,
      name,
      payrollMonth: month,
      processingDate: `${month.slice(0, 8)}28`,
      description,
      status,
      employeeIds,
      employeeCount: employeeIds.length,
      lastRunAt: stamp(closed ? 24 : 1),
      closedAt: closed ? stamp(21) : null,
      rowVersion: `00000000000000${id.slice(-2).replace(/\D/g, '0')}`,
      history: [
        log(`${id}_run`, 'run', closed ? 24 : 1, employeeIds.length),
        ...(closed ? [log(`${id}_close`, 'close', 21, employeeIds.length)] : []),
      ],
    }
  }
  const daily = (
    id: string,
    code: string,
    name: string,
    back: number,
    status: StoredPayroll['status'],
    employeeIds: string[],
  ): StoredPayroll => ({
    ...common,
    kind: 'daily_wage',
    id,
    code,
    name,
    payrollMonth: null,
    workDate: recentWorkday(back),
    timeSlotId: slot?.id ?? null,
    timeSlotName: slot?.title ?? null,
    currency: null,
    taxStructureId: null,
    taxStructureName: null,
    taxApplicable: false,
    processingMode: null,
    processingDate: null,
    applicableDays: 'actual',
    disbursementBankId: null,
    disbursementBankName: null,
    description: null,
    payItems: [],
    status,
    employeeIds,
    employeeCount: employeeIds.length,
    lastRunAt: stamp(back),
    closedAt: status === 'closed' ? stamp(back) : null,
    rowVersion: `00000000000001${id.slice(-1)}0`,
    history: [log(`${id}_process`, 'process', back, employeeIds.length)],
    rows: [],
  })
  // Abdul's last run could not pay Nida Hassan (she left in Islamabad): its one error.
  const abdul = monthly(
    'pr_8',
    'PR-00008',
    'Abdul (Pakistan-PKR)',
    thisMonth,
    'on_hold',
    ['br_isb', 'br_khi'],
    'Islamabad and Karachi offices.',
  )
  const nida = DIRECTORY.find((employee) => employee.id === 'em_nida')
  const abdulRun = abdul.history[0]
  const withError: StoredPayroll =
    nida && abdulRun
      ? {
          ...abdul,
          employeeIds: [...abdul.employeeIds, nida.id],
          employeeCount: abdul.employeeIds.length + 1,
          history: [{ ...abdulRun, errorCount: 1 }, ...abdul.history.slice(1)],
          errors: [
            {
              id: `${abdulRun.id}_${nida.id}`,
              payrollRunLogId: abdulRun.id,
              employeeId: nida.id,
              employeeCode: profileOf(nida).code,
              employeeName: nida.name,
              message: 'The employee is not active in the payroll month.',
              startedAt: abdulRun.startedAt,
            },
          ],
        }
      : abdul
  return [
    monthly(
      'pr_6',
      'PR-00006',
      'Head Office (Pakistan-PKR)',
      thisMonth,
      'running',
      ['br_lhr_ho'],
      'Head office staff in Lahore.',
    ),
    // Last month's Head Office run, closed: the released slips My Pay Slips shows the demo user.
    monthly(
      'pr_5',
      'PR-00005',
      `Head Office ${format(subMonths(new Date(), 1), 'MMMM')} (Pakistan-PKR)`,
      lastMonth,
      'closed',
      ['br_lhr_ho'],
      'Head office staff in Lahore, last month.',
    ),
    monthly(
      'pr_7',
      'PR-00007',
      'Software (Pakistan-PKR)',
      lastMonth,
      'closed',
      ['br_lhr_jt', 'br_rwp'],
      'Johar Town and Rawalpindi software teams.',
    ),
    withError,
    daily('dw_1', 'PR-00009', 'Daily Wages', 5, 'closed', ['em_kashif', 'em_imran']),
    daily('dw_2', 'PR-00010', 'Event Helpers', 2, 'running', ['em_sadia']),
  ]
}
