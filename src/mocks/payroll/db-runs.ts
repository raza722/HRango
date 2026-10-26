import type {
  DailyWageRow,
  PayrollError,
  PayrollRow,
  PayslipDetail,
  PayslipHistoryEntry,
  RunLog,
} from '@/features/payroll'

import { createMockCollection } from '../collection'
import { seedPayrolls } from './seed-runs'

// Monthly and daily-wage runs and their payslips, stored in the API's shapes.

const key = (name: string) => `hrms-mock-payroll-v2-${name}`

/** A run with who is on it (the API serves the people from `/payrolls/{id}/employees`). */
export type StoredPayroll = PayrollRow & {
  employeeIds: string[]
  history: RunLog[]
  /** Daily wages: the day's rows. */
  rows?: DailyWageRow[]
  /** The run errors (`GET …/errors`). */
  errors?: PayrollError[]
}

/** A payslip and its change log (`GET /payslips/{id}/history`). */
export type StoredPayslip = PayslipDetail & { history?: PayslipHistoryEntry[] }

export const payrolls = createMockCollection<StoredPayroll>({
  storageKey: key('payrolls'),
  seed: seedPayrolls,
})

/** Filled from the seeded runs on first use (`ensureRunsSeeded` in run-handlers). */
export const payslips = createMockCollection<StoredPayslip>({
  storageKey: key('payslips'),
  seed: () => [],
})

export const RUN_TABLES = [payrolls, payslips]
