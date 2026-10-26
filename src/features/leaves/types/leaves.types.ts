import type { Paginated } from '@/types/api'

/*
 * The Leaves module (sidebar → Leaves), in the backend's shapes (`/api/leaves`, see
 * backend/app/schemas/leaves.py): My Leaves and Leave Applications list the leave requests
 * of the requests module; Settings holds the general rules, the leave types and the leave
 * policies. Applying for and cancelling leave are request actions (`/api/requests/leave`,
 * the requests module), as is approving (`/api/requests/approvals/{id}/approve|reject`).
 * Ids are strings; dates are `yyyy-MM-dd`; timestamps ISO.
 */

// --- Leave applications ---------------------------------------------------------------------------

export const LEAVE_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'cancelling',
  'cancelled',
] as const
export type LeaveStatus = (typeof LEAVE_STATUSES)[number]

/** My Leaves is `my`; Leave Applications offers `subordinates` and `all`. */
export const LEAVE_TABS = ['my', 'subordinates', 'all'] as const
export type LeaveTab = (typeof LEAVE_TABS)[number]

/** The short leave kinds of the requests module (half day = 0.5, quarter day = 0.25). */
export const SHORT_LEAVE_TYPES = ['half_day', 'quarter_day'] as const
export type ShortLeaveType = (typeof SHORT_LEAVE_TYPES)[number]

/** A person's balance of one leave type in one leave year (`lv.fn_leave_balance`). */
export interface LeaveBalance {
  /** Credits: opening, allotment, earned, carry forward, adjustments. */
  entitled: number
  /** Availed, encashed and penalties, less restored days. */
  used: number
  /** Pending requests starting in the leave year. */
  pending: number
  available: number
}

/** `GET /leaves/applications`: a leave request as the Leaves lists show it. */
export interface LeaveApplication {
  id: string
  code: string
  status: LeaveStatus
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentId: string | null
  departmentName: string | null
  leaveTypeId: string
  leaveTypeTitle: string
  leaveTypeCode: string | null
  fromDate: string | null
  toDate: string | null
  days: number | null
  isShort: boolean
  shortLeaveType: string | null
  /** `HH:mm:ss` for a short leave. */
  startTime: string | null
  endTime: string | null
  reason: string | null
  submittedAt: string | null
  decidedAt: string | null
  cancelReason: string | null
  createdAt: string
}

/** `GET /leaves/applications/{id}`: with the person's balance of the type in that leave year. */
export interface LeaveApplicationDetail extends LeaveApplication {
  balance: LeaveBalance | null
}

/** `GET /leaves/applications/counts`. */
export type LeaveApplicationCounts = Record<'all' | LeaveStatus, number>

/** The list filters the backend takes (`/leaves/applications?…`). */
export interface LeaveApplicationFilters {
  leaveTypeId?: string | undefined
  employeeId?: string | undefined
  departmentId?: string | undefined
  fromDate?: string | undefined
  toDate?: string | undefined
  q?: string | undefined
}

export interface LeaveApplicationListParams {
  tab: LeaveTab
  status?: LeaveStatus | undefined
  page: number
  pageSize: number
  filters?: LeaveApplicationFilters | undefined
}

// --- The requests module, leave kind (`/api/requests/leave`) --------------------------------------

/** `POST /requests/leave`: Apply Leave. */
export interface LeaveRequestInput {
  /** Empty for your own leave; an employee for someone else ("All Requests"). */
  employeeId?: string | null
  fromDate: string
  toDate: string
  reason: string
  /** Uploaded files (`POST /files`, module `requests`) by id. */
  attachments: string[]
  details: {
    leaveTypeId: string
    isShort: boolean
    shortLeaveType: ShortLeaveType | null
    /** `HH:mm`, required for a short leave. */
    startTime: string | null
    endTime: string | null
  }
}

/** One approval step of a request (`RequestDetailOut.steps`). */
export interface LeaveRequestStep {
  id: string
  purpose: string
  stepNo: number | null
  approverKind: string | null
  approverId: string | null
  approverName: string | null
  actedById: string | null
  actedByName: string | null
  isDelegate: boolean
  isConsent: boolean
  actionTaken: string
  remarks: string | null
  actedAt: string | null
  createdAt: string
}

export interface LeaveRequestAttachment {
  id: string
  fileId: string
  name: string
  mimeType?: string | null
  sizeBytes?: number | null
  label?: string | null
  /** A signed link that expires. */
  url: string
  createdAt: string
}

/**
 * `GET /requests/leave/{id}` (the fields Leaves reads): the steps, attachments, what the
 * caller may do now (`view`, `edit`, `delete`, `cancel`, `approve`, `reject`, `forward`…)
 * and the `rowVersion` cancel and decisions send back.
 */
export interface LeaveRequestDetail {
  id: string
  code: string
  status: string
  employeeId: string
  employeeName: string | null
  nextApproverName: string | null
  nextApproverKind: string | null
  finalAuthorityName: string | null
  rowVersion: string
  steps: LeaveRequestStep[]
  attachments: LeaveRequestAttachment[]
  actions: string[]
}

export interface LeaveDecisionInput {
  decision: 'approve' | 'reject'
  remarks: string
  rowVersion: string
}

// --- Settings → General Settings ------------------------------------------------------------------

export const FINAL_APPROVAL_AUTHORITIES = ['hr_manager', 'line_manager', 'department_head'] as const
export type FinalApprovalBy = (typeof FINAL_APPROVAL_AUTHORITIES)[number]

export const APPROVE_ON_STATUSES = ['approved', 'pending'] as const
export type ApproveOnStatus = (typeof APPROVE_ON_STATUSES)[number]

export interface LeaveSettingsInput {
  /** Whose approval completes an application (stored; approval flows decide in this build). */
  finalApprovalBy: FinalApprovalBy
  /** The status at which an application counts as leave taken (stored only in this build). */
  approveOnStatus: ApproveOnStatus
  /** Back-dated applications must be posted within the type's Back Date Leave Limit in Days. */
  postDeadline: boolean
  rowVersion?: string | null
}

export interface LeaveSettings extends LeaveSettingsInput {
  /** Null until the settings are first saved. */
  rowVersion: string | null
}

// --- Settings → Leave Types -----------------------------------------------------------------------

export const LEAVE_GENDER_RULES = ['any', 'male', 'female'] as const
export type LeaveGenderRule = (typeof LEAVE_GENDER_RULES)[number]

export const LEAVE_MARITAL_RULES = ['any', 'married', 'single'] as const
export type LeaveMaritalRule = (typeof LEAVE_MARITAL_RULES)[number]

export const LEAVE_TENURES = ['yearly', 'monthly', 'employment'] as const
export type LeaveTenure = (typeof LEAVE_TENURES)[number]

export const BALANCE_BASES = ['flat', 'experience'] as const
export type BalanceBasis = (typeof BALANCE_BASES)[number]

export const ATTACHMENT_RULES = ['refuse', 'note'] as const
export type AttachmentRule = (typeof ATTACHMENT_RULES)[number]

/** Short Leave Slab "Type": a percentage of a day, or a flat number of days. */
export const SHORT_SLAB_VALUE_TYPES = ['percentage', 'flat'] as const
export type ShortSlabValueType = (typeof SHORT_SLAB_VALUE_TYPES)[number]

/** Balance According to = Experience: the balance of people with this much service. */
export interface ExperienceSlab {
  minMonths: number
  /** Null: no upper end. Ranges may not overlap (both ends count). */
  maxMonths: number | null
  balance: number
}

/** A short leave the type allows. */
export interface ShortLeaveSlab {
  name: string
  balance: number | null
  valueType: ShortSlabValueType
  value: number | null
}

/** `POST/PUT /leaves/types` (`LeaveTypeIn`). */
export interface LeaveTypeInput {
  title: string
  shortCode: string
  /** Days a tenure. */
  allowance: number
  // The switches, in the design's order.
  isProbationType: boolean
  isActive: boolean
  autoAllotment: boolean
  autoBalanceOnJoining: boolean
  isComposite: boolean
  isShortLeave: boolean
  showInPayslip: boolean
  isDeductible: boolean
  isSandwich: boolean
  sandwichAcrossTypes: boolean
  isEarned: boolean
  allowBackDate: boolean
  /** With Can Apply for Back Date. */
  backDateLimitDays: number | null
  hasFutureLimit: boolean
  /** With Has Future Date Limit. */
  futureLimitDays: number | null
  attachmentRequired: boolean
  /** With Attachment Required. */
  attachmentRule: AttachmentRule | null
  allowEncashment: boolean
  /** With Encashment. */
  encashmentMin: number | null
  encashmentMax: number | null
  carryForward: boolean
  proRated: boolean
  // Pre Condition.
  gender: LeaveGenderRule
  maritalStatus: LeaveMaritalRule
  allowedInProbation: boolean
  minExperienceMonths: number | null
  maxApplications: number | null
  gapBetweenApplicationsMonths: number | null
  // Balance Settings.
  tenure: LeaveTenure
  balanceBasis: BalanceBasis
  /** How many tenures unused days may accumulate over (null: none). */
  accumulativeCount: number | null
  experienceSlabs: ExperienceSlab[]
  shortSlabs: ShortLeaveSlab[]
  rowVersion?: string | null
}

/** `LeaveTypeOut`. */
export interface LeaveType extends Omit<LeaveTypeInput, 'allowance' | 'rowVersion'> {
  id: string
  allowance: number | null
  /** Ledger postings, leave requests and policies using the type; a type in use cannot be deleted. */
  inUse: number
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface LeaveTypeListParams {
  page: number
  pageSize: number
  q?: string | undefined
  isActive?: boolean | undefined
}

// --- Settings → Leave Policies --------------------------------------------------------------------

export const POLICY_LEVELS = ['company', 'employee'] as const
export type PolicyLevel = (typeof POLICY_LEVELS)[number]

/** The frame's two policies: "Leave Distribution Policy" and "Half leave & Short leave". */
export const POLICY_KINDS = ['distribution', 'half_short'] as const
export type PolicyKind = (typeof POLICY_KINDS)[number]

/** A leave type a distribution policy gives, with its own allowance (null: the type's). */
export interface PolicyTypeInput {
  leaveTypeId: string
  allowance: number | null
}

/** `POST/PUT /leaves/policies` (`LeavePolicyIn`). */
export interface LeavePolicyInput {
  title: string
  policyKind: PolicyKind
  policyLevel: PolicyLevel
  allowHalfDay: boolean
  allowShortLeave: boolean
  /** The "Status" switch of the list. */
  isActive: boolean
  types: PolicyTypeInput[]
  rowVersion?: string | null
}

export interface PolicyType {
  leaveTypeId: string
  leaveTypeTitle: string
  shortCode: string | null
  allowance: number | null
  /** The policy's allowance, else the type's. */
  effectiveAllowance: number | null
}

/** `LeavePolicyOut`. */
export interface LeavePolicy extends Omit<LeavePolicyInput, 'types' | 'rowVersion'> {
  id: string
  /** "No. of Leaves": the days the policy's types add up to. */
  totalLeaves: number | null
  /** Company level: everyone in the company; employee level: the people enrolled. */
  enrolledCount: number
  types: PolicyType[]
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface LeavePolicyListParams {
  page: number
  pageSize: number
  q?: string | undefined
  kind?: PolicyKind | undefined
}

/** `GET /leaves/policies/{id}/employees`. */
export interface EnrolledEmployee {
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName: string | null
  enrolledAt: string
}

// --- Balances, ledger, allotment, carry forward ---------------------------------------------------

/** `GET /leaves/balances`: one person's balance of one type in a leave year. */
export interface LeaveBalanceRow extends LeaveBalance {
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName: string | null
  leaveTypeId: string
  leaveTypeTitle: string
  shortCode: string | null
  fiscalYear: number
}

export interface LeaveBalanceParams {
  employeeId?: string | undefined
  leaveTypeId?: string | undefined
  /** `yyyy-MM-dd`: the leave year containing this day (default today). */
  asOf?: string | undefined
  q?: string | undefined
  page: number
  pageSize: number
}

export const LEDGER_INPUT_REASONS = ['opening', 'adjustment'] as const
export type LedgerInputReason = (typeof LEDGER_INPUT_REASONS)[number]

/** `POST /leaves/ledger`: an opening balance or a manual adjustment. */
export interface LedgerEntryInput {
  employeeId: string
  leaveTypeId: string
  entryDate: string
  /** + adds days, − takes them away. */
  days: number
  reason: LedgerInputReason
  remarks: string | null
}

export interface LedgerEntry {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  leaveTypeId: string
  leaveTypeTitle: string
  shortCode: string | null
  fiscalYear: number
  entryDate: string
  days: number
  /** opening, allotment, earned, carry_forward, adjustment, overtime, availed, encashed, penalty, restored. */
  reason: string
  remarks: string | null
  requestId: string | null
  requestCode: string | null
  leaveEncashmentId: string | null
  warningId: string | null
  createdAt: string
}

/** `POST /leaves/allotment/process` (idempotent). */
export interface AllotmentInput {
  fiscalYear: number
  asOf?: string | null
  leaveTypeId?: string | null
  employeeId?: string | null
}

export interface AllotmentResult {
  fiscalYear: number
  allotted: number
  earned: number
  days: number
}

/** `POST /leaves/carry-forward/process`. */
export interface CarryForwardInput {
  fromFiscalYear: number
  leaveTypeId?: string | null
  employeeId?: string | null
}

export interface CarryForwardResult {
  fromFiscalYear: number
  carried: number
  days: number
}

// --- Leave encashment (the Payroll → Leave Encashment screen calls these) -------------------------

export const ENCASHMENT_BASES = ['overtime', 'earned_salary', 'per_hour_rate', 'overnight'] as const
export type EncashmentBasis = (typeof ENCASHMENT_BASES)[number]

export const ENCASHMENT_MODES = ['payroll', 'manual'] as const
export type EncashmentMode = (typeof ENCASHMENT_MODES)[number]

export interface EncashmentInput {
  leaveTypeId: string
  fiscalYear: number
  encashmentDate: string
  appliesToAll: boolean
  employeeIds: string[]
  basis: EncashmentBasis
  amountPerLeave: number
  mode: EncashmentMode
}

export interface EncashmentUpdateInput {
  encashmentDate: string
  basis: EncashmentBasis
  amountPerLeave: number
  mode: EncashmentMode
  rowVersion: string | null
}

export interface EncashmentLine {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName: string | null
  days: number
  amount: number
  payslipId: string | null
}

export interface Encashment {
  id: string
  leaveTypeId: string
  leaveTypeTitle: string
  shortCode: string | null
  fiscalYear: number
  encashmentDate: string
  appliesToAll: boolean
  basis: EncashmentBasis
  amountPerLeave: number
  mode: EncashmentMode
  employeeCount: number
  totalDays: number
  totalAmount: number
  paidCount: number
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface EncashmentDetail extends Encashment {
  lines: EncashmentLine[]
}

export interface EncashmentListParams {
  page: number
  pageSize: number
  leaveTypeId?: string | undefined
  fiscalYear?: number | undefined
  employeeId?: string | undefined
  mode?: EncashmentMode | undefined
}

// --- Look-ups -------------------------------------------------------------------------------------

/** `GET /employees/lookup?permission=…`: the people the caller reaches through that code. */
export interface EmployeeLookup {
  id: string
  code: string
  name: string
  designationName: string | null
  jobTitleName: string | null
  departmentId?: string | null
  departmentName: string | null
  branchId?: string | null
  branchName: string
  status: string
  photoUrl: string | null
}

/**
 * `GET /requests/options/leave-types?employeeId=&asOf=` (`requests.leave.create`): a leave
 * type the person may apply for, with their balance and the type's form rules.
 */
export interface LeaveTypeOption {
  id: string
  name: string
  code: string | null
  isDeductible: boolean
  isShortLeave: boolean
  /** Half day allowed (the type and the person's Half & Short policy). */
  allowHalfDay: boolean
  /** Quarter day (short leave) allowed. */
  allowShortLeave: boolean
  attachmentRequired: boolean
  /** `refuse` (no attachment, no application) or `note` (accepted, marked for HR). */
  attachmentRule: string
  allowBackDate: boolean
  backDateLimitDays: number | null
  futureLimitDays: number | null
  entitled: number
  used: number
  pending: number
  available: number
}

/** `GET /organisation/lookups/departments`. */
export interface DepartmentLookup {
  id: string
  name: string
  code: string | null
  parentId: string | null
}

export type LeaveApplicationPage = Paginated<LeaveApplication>
