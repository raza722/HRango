import type {
  LeavePolicyInput,
  LeaveSettings,
  LeaveTypeInput,
} from '@/features/leaves/types/leaves.types'

/** A leave type stored by the Leaves module (`inUse` is counted on the way out). */
export interface StoredLeaveType extends LeaveTypeInput {
  id: string
  createdAt: string
}

export interface StoredLeavePolicy extends LeavePolicyInput {
  id: string
  /** Employee-level policies: who is enrolled. */
  enrolledIds: string[]
  createdAt: string
}

export interface StoredLeaveSettings extends LeaveSettings {
  id: 'settings'
}

const created = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()

/** Every switch off, no pre-conditions, a flat yearly balance. */
const BASE: Omit<LeaveTypeInput, 'title' | 'shortCode' | 'leavesAllowed'> = {
  probationType: false,
  active: true,
  autoAllotment: true,
  autoBalanceOnJoiningMonth: false,
  composite: false,
  shortLeave: false,
  showInPayslip: true,
  deductible: true,
  sandwich: false,
  sandwichAcrossTypes: false,
  earnedBalance: false,
  backDate: false,
  backDateLimitDays: null,
  futureDateLimit: false,
  attachmentRequired: false,
  attachmentRule: null,
  encashment: false,
  encashmentMin: null,
  encashmentMax: null,
  carryForward: false,
  proRated: false,
  gender: 'any',
  maritalStatus: 'any',
  applyInProbation: true,
  minExperienceMonths: 0,
  maxApplications: null,
  gapMonths: null,
  tenure: 'yearly',
  balanceBasis: 'flat',
  accumulativeCount: null,
  experienceSlabs: [],
  shortLeaveSlabs: [],
}

/**
 * Casual Leaves and Sick Leave keep the ids Requests → Leave seeds its
 * entitlements and requests with, so both modules show the same requests
 * under the same names. The rest are the types a Pakistani HR office keeps.
 */
export function seedLeaveTypes(): StoredLeaveType[] {
  return [
    {
      ...BASE,
      id: 'lt_casual',
      title: 'Casual Leaves',
      shortCode: 'CL',
      leavesAllowed: 10,
      shortLeave: true,
      backDate: true,
      backDateLimitDays: 3,
      futureDateLimit: true,
      proRated: true,
      shortLeaveSlabs: [
        { name: 'Quarter day', balance: 0.25, unit: 'hours', value: 2 },
        { name: 'Half day', balance: 0.5, unit: 'hours', value: 4 },
      ],
      createdAt: created(400),
    },
    {
      ...BASE,
      id: 'lt_sick',
      title: 'Sick Leave',
      shortCode: 'SL',
      leavesAllowed: 15,
      shortLeave: true,
      backDate: true,
      backDateLimitDays: 7,
      attachmentRequired: true,
      attachmentRule: 'note',
      shortLeaveSlabs: [{ name: 'Half day', balance: 0.5, unit: 'hours', value: 4 }],
      createdAt: created(400),
    },
    {
      ...BASE,
      id: 'lt_annual',
      title: 'Annual Leave',
      shortCode: 'AL',
      leavesAllowed: 14,
      earnedBalance: true,
      encashment: true,
      encashmentMin: 5,
      encashmentMax: 10,
      carryForward: true,
      sandwich: true,
      minExperienceMonths: 12,
      applyInProbation: false,
      balanceBasis: 'experience',
      experienceSlabs: [
        { minMonths: 12, maxMonths: 35, balance: 14 },
        { minMonths: 36, maxMonths: 83, balance: 18 },
        { minMonths: 84, maxMonths: 600, balance: 22 },
      ],
      createdAt: created(400),
    },
    {
      ...BASE,
      id: 'lt_urgent',
      title: 'Urgent Leave',
      shortCode: 'UL',
      leavesAllowed: 3,
      backDate: true,
      backDateLimitDays: 1,
      maxApplications: 3,
      gapMonths: 1,
      createdAt: created(300),
    },
    {
      ...BASE,
      id: 'lt_maternity',
      title: 'Maternity Leave',
      shortCode: 'ML',
      leavesAllowed: 90,
      gender: 'female',
      maritalStatus: 'married',
      applyInProbation: false,
      minExperienceMonths: 6,
      maxApplications: 2,
      gapMonths: 12,
      attachmentRequired: true,
      attachmentRule: 'refuse',
      sandwich: true,
      showInPayslip: false,
      tenure: 'employment',
      createdAt: created(300),
    },
    {
      ...BASE,
      id: 'lt_lwp',
      title: 'Leave Without Pay',
      shortCode: 'LWP',
      leavesAllowed: 0,
      autoAllotment: false,
      deductible: false,
      showInPayslip: false,
      backDate: true,
      backDateLimitDays: 15,
      createdAt: created(200),
    },
    {
      ...BASE,
      id: 'lt_probation',
      title: 'Probation Leave',
      shortCode: 'PL',
      leavesAllowed: 4,
      probationType: true,
      active: false,
      createdAt: created(100),
    },
  ]
}

/**
 * The frame's two rows ("Leave Distribution Policy" and "Half leave & Short
 * leave", both Company Level Policy) and one employee-level policy, so Enroll
 * Employee has somewhere to go.
 */
export function seedLeavePolicies(): StoredLeavePolicy[] {
  return [
    {
      id: 'lp_distribution',
      title: 'Leave Distribution Policy',
      kind: 'distribution',
      level: 'company',
      allowHalfDay: true,
      allowShortLeave: true,
      enforced: true,
      active: true,
      enrolledIds: [],
      createdAt: created(380),
    },
    {
      id: 'lp_half_short',
      title: 'Half leave & Short leave',
      kind: 'half-short',
      level: 'company',
      allowHalfDay: true,
      allowShortLeave: false,
      enforced: true,
      active: true,
      enrolledIds: [],
      createdAt: created(300),
    },
    {
      id: 'lp_senior',
      title: 'Senior Staff Short Leave',
      kind: 'half-short',
      level: 'employee',
      allowHalfDay: true,
      allowShortLeave: true,
      enforced: true,
      active: true,
      enrolledIds: ['em_bilal', 'em_hina', 'em_ayesha'],
      createdAt: created(120),
    },
  ]
}

export const DEFAULT_LEAVE_SETTINGS: StoredLeaveSettings = {
  id: 'settings',
  finalApprovalBy: 'hr-manager',
  approveOnStatus: 'approved',
  postDeadline: true,
}

export function seedLeaveSettings(): StoredLeaveSettings[] {
  return [{ ...DEFAULT_LEAVE_SETTINGS }]
}
