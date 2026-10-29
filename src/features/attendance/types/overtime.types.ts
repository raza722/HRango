import type { PaginationMeta } from '@/types/api'

/*
 * Attendance → Overtime as the API has it: overtime is a request type of the request engine
 * (`/requests/overtime`, approved through `/requests/approvals`), and the policies and
 * settings are Attendance settings (`/attendance/settings/overtime-policies`,
 * `/attendance/settings/overtime`).
 */

export const OVERTIME_TABS = [
  'my',
  'applications',
  'bulk-applications',
  'bulk-overtime',
  'policy',
  'settings',
] as const
export type OvertimeTab = (typeof OVERTIME_TABS)[number]

/** A request's status as the API names it. */
export const OVERTIME_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'cancelling',
  'cancelled',
] as const
export type OvertimeStatus = (typeof OVERTIME_STATUSES)[number]

/**
 * The URL's status filter: a status, or `unapproved` (Applications' Unapproved: the requests
 * waiting for your decision, the approvals' `status=pending`).
 */
export const OVERTIME_STATUS_FILTERS = [...OVERTIME_STATUSES, 'unapproved'] as const
export type OvertimeStatusFilter = (typeof OVERTIME_STATUS_FILTERS)[number]

/**
 * Approvals boxes Applications reads (`GET /requests/approvals?box=`); Consents holds the
 * requests a Can Disagree step asks you to agree with.
 */
export const OVERTIME_APPROVAL_BOXES = [
  'requested',
  'delegates',
  'consents',
  'cancellations',
] as const
export type OvertimeApprovalBox = (typeof OVERTIME_APPROVAL_BOXES)[number]

export const OVERTIME_POLICY_PERIODS = ['daily', 'monthly'] as const
export type OvertimePolicyPeriod = (typeof OVERTIME_POLICY_PERIODS)[number]

/** A slab encashes as a full day, or as a leave of a chosen leave type. */
export const ENCASHMENT_TYPES = ['full_day', 'leave'] as const
export type EncashmentType = (typeof ENCASHMENT_TYPES)[number]

// --- requests ------------------------------------------------------------------------------------

/** `details` of an overtime request as the API sends them back (`RequestOut.details`). */
export interface OvertimeDetailsOut {
  departmentId?: string | number | null
  departmentName?: string | null
  locationId?: string | number | null
  locationName?: string | null
  branchId?: string | number | null
  branchName?: string | null
  overtimeDate?: string | null
  /** `HH:mm:ss`. */
  startTime?: string | null
  endTime?: string | null
  appliedMinutes?: number | null
  approvedMinutes?: number | null
}

/** `details` of `POST/PUT /requests/overtime` (`OvertimeDetails`). */
export interface OvertimeDetailsIn {
  departmentId: string
  locationId: string | null
  branchId: string | null
  overtimeDate: string
  /** `HH:mm`. */
  startTime: string
  endTime: string
  appliedMinutes: number
}

/** `POST /requests/overtime` and `PUT /requests/overtime/{id}` (`RequestIn[OvertimeDetails]`). */
export interface OvertimeRequestBody {
  /** Left out: the caller's own request; set: filed on that person's behalf. */
  employeeId?: string | null
  fromDate: string
  toDate: string
  reason: string | null
  /** Uploaded file ids (`POST /files`, module `requests`); `PUT` ignores them. */
  attachments: string[]
  details: OvertimeDetailsIn
  /** Required on edit. */
  rowVersion?: string
}

/** An overtime request as the screens show it (a `RequestOut` with its details read). */
export interface OvertimeApplication {
  id: string
  code: string
  employeeId: string
  employeeName: string
  employeeCode: string
  departmentId: string | null
  departmentName: string | null
  locationId: string | null
  locationName: string | null
  branchId: string | null
  branchName: string | null
  /** `yyyy-MM-dd`. */
  date: string
  /** `HH:mm`. */
  startTime: string
  endTime: string
  appliedMinutes: number
  approvedMinutes: number | null
  reason: string | null
  status: OvertimeStatus
  submittedAt: string
  decidedAt: string | null
  cancelReason: string | null
  nextApproverId: string | null
  nextApproverName: string | null
  finalAuthorityName: string | null
  rowVersion: string
  /** Approvals lists only: the step waits for the caller. */
  isWaiting: boolean | null
  /** Approvals → Delegates: whose approval the caller holds. */
  delegatorName: string | null
}

/** One step of the request (the API records a step when the flow reaches it). */
export interface OvertimeStep {
  id: string
  /** "Line Manager", "Final Authority (Cancellation)", "Requested" … */
  label: string
  personName: string | null
  /** submitted, pending, approved, rejected, skipped, forwarded, withdrawn, cancel_requested … */
  action: string
  remarks: string | null
  at: string | null
}

export interface OvertimeAttachment {
  id: string
  fileId: string
  name: string
  url: string
}

/** Actions the API lists on a request's detail. */
export type OvertimeAction =
  'view' | 'edit' | 'delete' | 'cancel' | 'approve' | 'reject' | 'consent' | 'disagree' | 'forward'

/** One request with its steps, files and what the caller may do (`RequestDetailOut`). */
export interface OvertimeApplicationDetail extends OvertimeApplication {
  steps: OvertimeStep[]
  attachments: OvertimeAttachment[]
  actions: OvertimeAction[]
}

/** A list page with the status counts (`RequestPage`). */
export interface OvertimeApplicationPage {
  data: OvertimeApplication[]
  meta: PaginationMeta
  counts: Record<OvertimeStatus, number>
}

/** `GET /requests/overtime` filters. */
export interface OvertimeListParams {
  view: 'my' | 'subordinates' | 'all'
  status?: OvertimeStatus | undefined
  q?: string | undefined
  employeeId?: string | undefined
  from?: string | undefined
  to?: string | undefined
  page: number
  pageSize: number
}

/** `GET /requests/overtime/export`: the list's filters without the page. */
export type OvertimeExportParams = Omit<OvertimeListParams, 'page' | 'pageSize'>

/** `GET /requests/approvals?type=overtime` filters. */
export interface OvertimeApprovalParams {
  box: OvertimeApprovalBox
  status?: OvertimeStatus | undefined
  q?: string | undefined
  employeeId?: string | undefined
  from?: string | undefined
  to?: string | undefined
  page: number
  pageSize: number
}

/** `POST /requests/approvals/{id}/approve | reject`. */
export interface OvertimeDecisionInput {
  remarks: string | null
  /** Approve: the minutes granted (the API keeps the applied minutes when left out). */
  approvedMinutes?: number | null
  rowVersion: string
}

/** One result of `POST /requests/approvals/bulk-approve | bulk-reject` (`BulkResultOut`). */
export interface OvertimeBulkResult {
  id: string
  ok: boolean
  status?: string | null
  code?: string | null
  message?: string | null
}

// --- policies --------------------------------------------------------------------------------------

export interface OvertimeSlab {
  id: string
  minMinutes: number
  maxMinutes: number
  encashmentType: EncashmentType
  /** The leave type of a `leave` slab. */
  leaveTypeId: string | null
  leaveTypeName: string | null
}

/** `OvertimePolicyOut`. */
export interface OvertimePolicy {
  id: string
  name: string
  period: OvertimePolicyPeriod
  description: string | null
  isActive: boolean
  slabCount: number
  slabs: OvertimeSlab[]
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

/** `OvertimeSlabIn`. */
export interface OvertimeSlabInput {
  minMinutes: number
  maxMinutes: number
  encashmentType: EncashmentType
  leaveTypeId: string | null
}

/** `OvertimePolicyIn`. */
export interface OvertimePolicyInput {
  name: string
  period: OvertimePolicyPeriod
  description: string | null
  isActive: boolean
  slabs: OvertimeSlabInput[]
  rowVersion?: string | null
}

/** `GET /attendance/settings/overtime-policies` filters. */
export interface OvertimePolicyParams {
  page: number
  pageSize: number
  q?: string | undefined
  period?: OvertimePolicyPeriod | undefined
}

/** A leave type a `leave` slab can encash into (`GET /leaves/types`). */
export interface OvertimeLeaveType {
  id: string
  title: string
  shortCode: string
  isActive: boolean
}

// --- settings --------------------------------------------------------------------------------------

/** `GET/PUT /attendance/settings/overtime` (`OvertimeSettings`). */
export interface OvertimeSettings {
  overtimeOnCheckIn: boolean
  overtimeOnCheckOut: boolean
  overtimeApprovalRequired: boolean
  doNotAutoCreateRequests: boolean
  overtimeOnHolidays: boolean
  overtimeAfterDutyDuration: boolean
  /** Shift length the encashment counts in, 0–1440 minutes. */
  encashmentShiftMinutes: number
  rowVersion: string | null
}

/** What a person's approved overtime of a month adds up to under the monthly policy (mock helper). */
export interface MonthlyOvertime {
  employeeId: string
  /** `yyyy-MM`. */
  month: string
  approvedMinutes: number
  slab: OvertimeSlab | null
}
