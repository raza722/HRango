import type {
  Encashment,
  EncashmentLine,
  LeavePolicy,
  LeaveRequestAttachment,
  LeaveRequestStep,
  LeaveSettings,
  LeaveType,
  LeaveTypeInput,
} from '@/features/leaves/types/leaves.types'

/*
 * Seed data of the Leaves mock, in the backend's shapes (backend/app/schemas/leaves.py).
 * The mock keeps its own people, so it does not depend on other modules' mocks; the
 * signed-in mock user is Shelley Kannes (`MOCK_SELF_ID`).
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

export const MOCK_SELF_ID = 'em_shelley'

export const MOCK_DEPARTMENTS = [
  { id: 'dp_hr', name: 'Human Resources' },
  { id: 'dp_eng', name: 'Engineering' },
  { id: 'dp_fin', name: 'Finance' },
] as const

const person = (
  id: string,
  code: string,
  name: string,
  department: (typeof MOCK_DEPARTMENTS)[number],
  designationName: string,
  gender: MockPerson['gender'],
  maritalStatus: MockPerson['maritalStatus'],
  joiningDate: string,
  lineManagerId: string | null,
): MockPerson => ({
  id,
  code,
  name,
  departmentId: department.id,
  departmentName: department.name,
  designationName,
  gender,
  maritalStatus,
  joiningDate,
  lineManagerId,
  status: 'active',
})

const [HR, ENG, FIN] = MOCK_DEPARTMENTS

export const MOCK_PEOPLE: readonly MockPerson[] = [
  person(
    MOCK_SELF_ID,
    'Id-001',
    'Shelley Kannes',
    HR,
    'HR Manager',
    'female',
    'married',
    '2019-03-01',
    null,
  ),
  person(
    'em_sadia',
    'Id-002',
    'Sadia Rehman',
    ENG,
    'Software Engineer',
    'female',
    'single',
    '2022-06-15',
    MOCK_SELF_ID,
  ),
  person(
    'em_maryam',
    'Id-003',
    'Maryam Javed',
    ENG,
    'QA Engineer',
    'female',
    'married',
    '2023-01-09',
    MOCK_SELF_ID,
  ),
  person(
    'em_omer',
    'Id-004',
    'Omer Farooq',
    FIN,
    'Accountant',
    'male',
    'married',
    '2021-09-01',
    'em_bilal',
  ),
  person(
    'em_bilal',
    'Id-005',
    'Bilal Ahmed',
    FIN,
    'Finance Manager',
    'male',
    'single',
    '2018-11-20',
    MOCK_SELF_ID,
  ),
]

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

/** A leave request as the mock keeps it (the requests module owns the real ones). */
export interface StoredLeaveRequest {
  id: string
  code: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelling' | 'cancelled'
  employeeId: string
  leaveTypeId: string
  fromDate: string
  toDate: string
  days: number
  isShort: boolean
  shortLeaveType: string | null
  startTime: string | null
  endTime: string | null
  reason: string | null
  submittedAt: string
  decidedAt: string | null
  cancelReason: string | null
  createdAt: string
  rowVersion: string
  steps: LeaveRequestStep[]
  attachments: LeaveRequestAttachment[]
}

const isoDay = (offset: number) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

const step = (
  id: string,
  approverKind: string,
  approverName: string | null,
  actionTaken: string,
  daysAgo: number | null,
  remarks: string | null = null,
): LeaveRequestStep => ({
  id,
  purpose: 'request',
  stepNo: approverKind === 'requester' ? null : 1,
  approverKind,
  approverId: null,
  approverName,
  actedById: null,
  actedByName: daysAgo === null ? null : approverName,
  isDelegate: false,
  isConsent: false,
  actionTaken,
  remarks,
  actedAt: daysAgo === null ? null : stamp(daysAgo),
  createdAt: stamp(daysAgo ?? 0),
})

function request(
  number: number,
  employeeId: string,
  leaveTypeId: string,
  status: StoredLeaveRequest['status'],
  from: number,
  to: number,
  reason: string,
  extra: Partial<StoredLeaveRequest> = {},
): StoredLeaveRequest {
  const decided = status !== 'pending'
  const code = `RQ-LV-${String(number).padStart(4, '0')}`
  return {
    id: `lv_${String(number).padStart(4, '0')}`,
    code,
    status,
    employeeId,
    leaveTypeId,
    fromDate: isoDay(from),
    toDate: isoDay(to),
    days: to - from + 1,
    isShort: false,
    shortLeaveType: null,
    startTime: null,
    endTime: null,
    reason,
    submittedAt: stamp(10 + number),
    decidedAt: decided ? stamp(5) : null,
    cancelReason: null,
    createdAt: stamp(10 + number),
    rowVersion: nextRowVersion(),
    steps: [
      step(`st_${String(number)}_0`, 'requester', null, 'submitted', 10 + number),
      step(
        `st_${String(number)}_1`,
        'line_manager',
        'Shelley Kannes',
        decided ? (status === 'rejected' ? 'rejected' : 'approved') : 'pending',
        decided ? 5 : null,
      ),
    ],
    attachments: [],
    ...extra,
  }
}

export function seedLeaveRequests(): StoredLeaveRequest[] {
  return [
    request(1, 'em_sadia', 'lt_casual', 'pending', 9, 10, 'Family wedding.'),
    request(2, 'em_maryam', 'lt_sick', 'pending', 3, 3, 'Doctor appointment.'),
    request(3, 'em_omer', 'lt_annual', 'approved', -20, -16, 'Holiday with family.'),
    request(4, 'em_bilal', 'lt_casual', 'rejected', 14, 14, 'Personal errand.'),
    request(5, 'em_sadia', 'lt_annual', 'cancelling', 30, 31, 'Trip home.', {
      cancelReason: 'Plans changed.',
    }),
    request(6, MOCK_SELF_ID, 'lt_casual', 'approved', -40, -40, 'Bank and passport office.'),
    request(7, MOCK_SELF_ID, 'lt_casual', 'pending', 12, 12, 'School meeting.', {
      isShort: true,
      shortLeaveType: 'half_day',
      startTime: '09:00:00',
      endTime: '13:00:00',
      days: 0.5,
    }),
    request(8, MOCK_SELF_ID, 'lt_sick', 'cancelled', -60, -59, 'Flu.', {
      cancelReason: 'Recovered early.',
    }),
  ]
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
