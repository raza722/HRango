import type {
  Encashment,
  EncashmentLine,
  LeavePolicy,
  LeaveSettings,
  LeaveType,
  LeaveTypeInput,
} from '@/features/leaves/types/leaves.types'

import { joiningDate } from '../attendance/seed'
import { DIRECTORY, type DirectoryEmployee } from '../employees/seed'
import { lineManagerOf } from '../requests/people'
import { CURRENT_EMPLOYEE_ID, profileOf } from '../scheduling/seed'

/*
 * Seed data of the Leaves mock, in the backend's shapes (backend/app/schemas/leaves.py).
 * The people are the shared directory's (`src/mocks/employees/seed.ts`) with the codes,
 * departments, joining dates and managers the other modules give them; the signed-in mock
 * user is Shelley Kannes (`MOCK_SELF_ID`). The leave requests themselves are the Requests
 * module's (`src/mocks/requests/standard/kinds/leave.ts`; read through `./requests.ts`).
 */

export interface MockPerson {
  id: string
  code: string
  name: string
  departmentId: string
  departmentName: string
  designationName: string
  gender: 'male' | 'female'
  maritalStatus: 'single' | 'married'
  joiningDate: string
  lineManagerId: string | null
  status: 'active' | 'inactive'
}

export const MOCK_SELF_ID = CURRENT_EMPLOYEE_ID

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-')

/** A department's id as `GET /organisation/lookups/departments` gives it (`dep_<slug>`). */
export const departmentIdOf = (name: string) => `dep_${slug(name)}`

function toPerson(employee: DirectoryEmployee, index: number): MockPerson {
  const profile = profileOf(employee)
  return {
    id: employee.id,
    code: profile.code,
    name: employee.name,
    departmentId: departmentIdOf(employee.department),
    departmentName: employee.department,
    designationName: employee.jobTitle,
    gender: profile.gender === 'female' ? 'female' : 'male',
    // As Talent Management's records have it.
    maritalStatus: index % 3 === 0 ? 'single' : 'married',
    joiningDate: joiningDate(employee),
    lineManagerId: employee.id === MOCK_SELF_ID ? null : lineManagerOf(employee),
    status: profile.status === 'active' ? 'active' : 'inactive',
  }
}

let people: readonly MockPerson[] | null = null

/** Everyone in the directory, as the leave rules read them (worked out on first use). */
export function mockPeople(): readonly MockPerson[] {
  people ??= DIRECTORY.map(toPerson)
  return people
}

/** The directory's departments, as the department look-up lists them. */
export function mockDepartments(): { id: string; name: string }[] {
  return [...new Set(DIRECTORY.map((employee) => employee.department))]
    .sort()
    .map((name) => ({ id: departmentIdOf(name), name }))
}

/** The leave year of the mock: the calendar year. */
export const thisYear = () => new Date().getFullYear()

const stamp = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()

let version = 1000
/** A fresh rowVersion, as the database's rowversion column would give. */
export const nextRowVersion = () => {
  version += 1
  return version.toString(16).padStart(16, '0')
}

/** A leave type as stored (inUse is counted on the way out). */
export type StoredLeaveType = Omit<LeaveType, 'inUse'>

/** Every switch off, no pre-conditions, a flat yearly balance. */
const BASE: Omit<LeaveTypeInput, 'title' | 'shortCode' | 'allowance'> = {
  isProbationType: false,
  isActive: true,
  autoAllotment: true,
  autoBalanceOnJoining: false,
  isComposite: false,
  isShortLeave: false,
  showInPayslip: true,
  isDeductible: true,
  isSandwich: false,
  sandwichAcrossTypes: false,
  isEarned: false,
  allowBackDate: false,
  backDateLimitDays: null,
  hasFutureLimit: false,
  futureLimitDays: null,
  attachmentRequired: false,
  attachmentRule: null,
  allowEncashment: false,
  encashmentMin: null,
  encashmentMax: null,
  carryForward: false,
  proRated: false,
  gender: 'any',
  maritalStatus: 'any',
  allowedInProbation: true,
  minExperienceMonths: null,
  maxApplications: null,
  gapBetweenApplicationsMonths: null,
  tenure: 'yearly',
  balanceBasis: 'flat',
  accumulativeCount: null,
  experienceSlabs: [],
  shortSlabs: [],
}

const type = (
  id: string,
  title: string,
  shortCode: string,
  allowance: number,
  extra: Partial<LeaveTypeInput>,
  daysAgo: number,
): StoredLeaveType => ({
  ...BASE,
  ...extra,
  id,
  title,
  shortCode,
  allowance,
  createdAt: stamp(daysAgo),
  updatedAt: null,
  rowVersion: nextRowVersion(),
})

export function seedLeaveTypes(): StoredLeaveType[] {
  return [
    type(
      'lt_casual',
      'Casual Leaves',
      'CL',
      8,
      {
        isShortLeave: true,
        shortSlabs: [{ name: 'Two hours', balance: 1, valueType: 'percentage', value: 25 }],
        // Payroll → Leave Encashment pays these out (2 to 10 days a person).
        allowEncashment: true,
        encashmentMin: 2,
        encashmentMax: 10,
      },
      400,
    ),
    type(
      'lt_sick',
      'Sick Leave',
      'SL',
      15,
      {
        attachmentRequired: true,
        attachmentRule: 'note',
        allowBackDate: true,
        backDateLimitDays: 7,
        allowEncashment: true,
        encashmentMin: 1,
        encashmentMax: 8,
      },
      390,
    ),
    type(
      'lt_annual',
      'Annual Leave',
      'AL',
      14,
      { allowEncashment: true, encashmentMin: 1, encashmentMax: 10, carryForward: true },
      380,
    ),
    type(
      'lt_probation',
      'Probation Leave',
      'PL',
      3,
      { isActive: false, isProbationType: true },
      370,
    ),
    type('lt_unpaid', 'Unpaid Leave', 'UL', 0, { isDeductible: false, autoAllotment: false }, 360),
  ]
}

/** A policy as stored: its types by id and who is enrolled (employee level). */
export interface StoredLeavePolicy extends Omit<
  LeavePolicy,
  'types' | 'totalLeaves' | 'enrolledCount'
> {
  types: { leaveTypeId: string; allowance: number | null }[]
  enrolled: { employeeId: string; enrolledAt: string }[]
}

export function seedLeavePolicies(): StoredLeavePolicy[] {
  const base = { createdAt: stamp(300), updatedAt: null, isActive: true }
  return [
    {
      ...base,
      id: 'lp_distribution',
      title: 'Leave Distribution Policy',
      policyKind: 'distribution',
      policyLevel: 'company',
      allowHalfDay: false,
      allowShortLeave: false,
      types: [
        { leaveTypeId: 'lt_casual', allowance: null },
        { leaveTypeId: 'lt_sick', allowance: null },
        { leaveTypeId: 'lt_annual', allowance: null },
        { leaveTypeId: 'lt_unpaid', allowance: null },
      ],
      enrolled: [],
      rowVersion: nextRowVersion(),
    },
    {
      ...base,
      id: 'lp_half_short',
      title: 'Half leave & Short leave',
      policyKind: 'half_short',
      policyLevel: 'company',
      allowHalfDay: true,
      allowShortLeave: true,
      types: [],
      enrolled: [],
      rowVersion: nextRowVersion(),
    },
  ]
}

export interface StoredLeaveSettings extends LeaveSettings {
  id: 'settings'
}

export const DEFAULT_LEAVE_SETTINGS: StoredLeaveSettings = {
  id: 'settings',
  finalApprovalBy: 'hr_manager',
  approveOnStatus: 'approved',
  postDeadline: false,
  rowVersion: null,
}

export function seedLeaveSettings(): StoredLeaveSettings[] {
  return [{ ...DEFAULT_LEAVE_SETTINGS }]
}

/** A leave ledger row (credits and manual debits; availed days come from the requests). */
export interface StoredLedgerEntry {
  id: string
  employeeId: string
  leaveTypeId: string
  fiscalYear: number
  entryDate: string
  days: number
  reason: string
  remarks: string | null
  leaveEncashmentId: string | null
  createdAt: string
}

/** An encashment as stored, with its lines. */
export interface StoredEncashment extends Omit<
  Encashment,
  'leaveTypeTitle' | 'shortCode' | 'employeeCount' | 'totalDays' | 'totalAmount' | 'paidCount'
> {
  lines: Omit<EncashmentLine, 'employeeCode' | 'employeeName' | 'departmentName'>[]
}

export function seedEncashments(): StoredEncashment[] {
  return [
    {
      id: 'le_1',
      leaveTypeId: 'lt_annual',
      fiscalYear: thisYear() - 1,
      encashmentDate: `${String(thisYear() - 1)}-12-31`,
      appliesToAll: false,
      basis: 'earned_salary',
      amountPerLeave: 2500,
      mode: 'manual',
      createdAt: stamp(200),
      updatedAt: null,
      rowVersion: nextRowVersion(),
      lines: [{ id: 'lel_1', employeeId: 'em_omer', days: 4, amount: 10_000, payslipId: null }],
    },
  ]
}
