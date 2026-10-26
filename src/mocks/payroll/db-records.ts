import { format, subDays, subMonths } from 'date-fns'

import type {
  EmployeeAccountRow,
  LeaveEncashmentDetail,
  OpeningBalanceEntry,
  VoucherRow,
} from '@/features/payroll'

import { createMockCollection } from '../collection'
import {
  seedAccountEntries,
  seedLeaveEncashments,
  seedOpeningBalances,
  seedVouchers,
} from './seed-records'

// Vouchers, final settlement, balances, salary revision and leave encashment.
// Stores keep the API's shapes, except the two other mocks write into (kept as they were):
// salary revisions (Requests → promotion) and final settlements (Off-boarding).

const key = (name: string) => `hrms-mock-payroll-v2-${name}`

/**
 * A salary revision as the mock keeps it (the Requests mock writes promotions in this shape,
 * typed there as the feature's deprecated `SalaryRevision`); the handlers map it to the API's row.
 */
export interface StoredSalaryRevision {
  id: string
  code: string
  employeeId: string
  effectiveDate: string
  type: 'flat' | 'percentage'
  percentage: number | null
  previousSalary: number
  salary: number
}

/** The off-boarding mock creates and completes these; the API's view is mapped in the handlers. */
export interface StoredFinalSettlement {
  id: string
  employeeId: string
  reason: string
  resignationDate: string
  noticePeriod: boolean
  lastWorkingDate: string
  finalSettlement: boolean
  attachmentName: string | null
  description: string
  /** `pending` until closed, then `completed`. */
  status: 'pending' | 'completed'
  payslipId: string | null
  fileId?: string | null
  closedAt?: string | null
}

const find = (id: string) => id

export function seedSalaryRevisions(): StoredSalaryRevision[] {
  return [
    {
      id: 'sr_1',
      code: 'SR-00001',
      employeeId: find('em_rehan'),
      effectiveDate: format(subMonths(new Date(), 3), 'yyyy-MM-01'),
      type: 'flat',
      percentage: null,
      previousSalary: 170_000,
      salary: 200_000,
    },
    {
      id: 'sr_2',
      code: 'SR-00002',
      employeeId: find('em_maryam'),
      effectiveDate: format(subMonths(new Date(), 1), 'yyyy-MM-15'),
      type: 'percentage',
      percentage: 10,
      previousSalary: 110_000,
      salary: 121_000,
    },
  ]
}

export function seedFinalSettlements(): StoredFinalSettlement[] {
  const day = (back: number) => format(subDays(new Date(), back), 'yyyy-MM-dd')
  return [
    {
      id: 'fs_talha',
      employeeId: 'em_talha',
      reason: 'resignation',
      resignationDate: day(45),
      noticePeriod: true,
      lastWorkingDate: day(15),
      finalSettlement: true,
      attachmentName: 'resignation-letter.pdf',
      description: 'Moving abroad.',
      status: 'pending',
      payslipId: null,
    },
    {
      id: 'fs_nida',
      employeeId: 'em_nida',
      reason: 'resignation',
      resignationDate: day(80),
      noticePeriod: true,
      lastWorkingDate: day(50),
      finalSettlement: true,
      attachmentName: null,
      description: '',
      status: 'completed',
      payslipId: null,
    },
  ]
}

export const salaryRevisions = createMockCollection<StoredSalaryRevision>({
  storageKey: key('salary-revisions'),
  seed: seedSalaryRevisions,
})
export const finalSettlements = createMockCollection<StoredFinalSettlement>({
  storageKey: key('final-settlements'),
  seed: seedFinalSettlements,
})
export const openingBalances = createMockCollection<OpeningBalanceEntry>({
  storageKey: key('opening-balances'),
  seed: seedOpeningBalances,
})
export const accountEntries = createMockCollection<EmployeeAccountRow>({
  storageKey: key('account-entries'),
  seed: seedAccountEntries,
})
/** Every voucher: raised by people, and made from closed daily-wage runs. */
export const vouchers = createMockCollection<VoucherRow>({
  storageKey: key('vouchers'),
  seed: seedVouchers,
})
export const leaveEncashments = createMockCollection<LeaveEncashmentDetail>({
  storageKey: key('leave-encashments'),
  seed: seedLeaveEncashments,
})

export const RECORD_TABLES = [
  salaryRevisions,
  finalSettlements,
  openingBalances,
  accountEntries,
  vouchers,
  leaveEncashments,
]
