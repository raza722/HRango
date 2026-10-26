// Benefits Management, as the API (`/benefits/*`) returns it: plan years, the plan catalogue,
// enrollment windows, employees with their elections and missing details, and the plans'
// files. Ids are strings; dates `yyyy-MM-dd`; times ISO.

import type { FileRef } from '@/lib/files'

/** The card's sub menu, one route each under /benefits. */
export type BenefitsTab = 'plan-years' | 'plans' | 'enrollment-windows' | 'employees' | 'files'

/** The plan year row menu. */
export type PlanYearAction = 'edit' | 'delete' | 'open-enrollment' | 'new-hire' | 'life-event'

/** The Add New Plan menu's categories, in its order. */
export type PlanCategory =
  'medical' | 'dental' | 'vision' | 'retirement' | 'hsa' | 'life' | 'others'

/** "When can new hires start their benefits enrollment?" */
export type NewHireStart = 'immediately' | 'waiting_period' | 'per_employee'

/** "How long do new employees have to complete elections?" unit. */
export type ElectionUnit = 'day' | 'week' | 'month'

/** Where an employee's elections for a plan year stand. */
export type ElectionStatus = 'incomplete' | 'pending' | 'approved' | 'rejected' | 'waived'

/** A plan year by its dates: before, during or after. */
export type PlanYearStatus = 'upcoming' | 'active' | 'ended'

/** An enrollment window until and after its last day. */
export type WindowStatus = 'open' | 'closed'

/** Open enrollment, a qualifying life event, or a new hire's window. */
export type WindowKind = 'open_enrollment' | 'life_event' | 'new_hire'

export interface BenefitsSummary {
  planYears: number
  plans: number
  enrollmentWindows: number
  employees: number
}

export interface PlanYear {
  id: string
  name: string
  startDate: string
  endDate: string
  status: PlanYearStatus
  newHireStart: NewHireStart
  /** Days, when new hires start after a waiting period. */
  waitingPeriodDays: number | null
  electionPeriod: number
  electionUnit: ElectionUnit
  /** The plans offered this year. */
  planIds: string[]
  planCount: number
  windowCount: number
  pending: number
  approved: number
  incomplete: number
  /** People whose benefit details are not complete. */
  missingInformation: number
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  rowVersion: string
}

export interface PlanYearInput {
  name: string
  startDate: string
  endDate: string
  planIds: string[]
  newHireStart: NewHireStart
  waitingPeriodDays: number | null
  electionPeriod: number
  electionUnit: ElectionUnit
  rowVersion?: string | undefined
}

export interface BenefitPlan {
  id: string
  category: PlanCategory
  name: string
  planType: string | null
  /** The carrier's id of the plan type ("Plan Type ID"). */
  planTypeRef: string | null
  carrier: string | null
  startDate: string
  endDate: string
  description: string | null
  status: 'active' | 'inactive'
  /** People with an approved election of the plan. */
  enrolled: number
  /** People whose election of the plan waits for approval. */
  pending: number
  fileCount: number
  planYearIds: string[]
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  rowVersion: string
}

export interface PlanInput {
  category: PlanCategory
  name: string
  planType: string | null
  planTypeRef: string | null
  carrier: string | null
  startDate: string
  endDate: string
  description: string | null
  status: 'active' | 'inactive'
  rowVersion?: string | undefined
}

export interface EnrollmentWindow {
  id: string
  name: string
  kind: WindowKind
  planYearId: string
  planYearName: string
  /** "When will this plan within this window become effective?" */
  effectiveDate: string
  /** The last day to enrol. */
  closesOn: string
  status: WindowStatus
  description: string | null
  planIds: string[]
  /** Empty: everyone may enrol. */
  employeeIds: string[]
  electionCount: number
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  rowVersion: string
}

export interface EnrollmentWindowInput {
  planYearId: string
  kind: WindowKind
  name: string
  effectiveDate: string
  closesOn: string
  description: string | null
  planIds: string[]
  employeeIds: string[]
  rowVersion?: string | undefined
}

/** A detail benefits enrollment needs that is blank on the employee. */
export type MissingDetail = 'date_of_birth' | 'marital_status'

/** The Employees tab: a person, their election in the plan year shown, and what they miss. */
export interface BenefitEmployee {
  id: string
  code: string | null
  name: string | null
  jobTitleName: string | null
  departmentName: string | null
  dateOfBirth: string | null
  maritalStatus: string | null
  missing: MissingDetail[]
  /** Only with a plan year chosen. */
  electionId: string | null
  electionStatus: ElectionStatus | null
}

/** An employee's choice of plans for a plan year (`/benefits/elections`, no screen yet). */
export interface Election {
  id: string
  employeeId: string
  employeeCode: string | null
  employeeName: string | null
  departmentName: string | null
  jobTitleName: string | null
  planYearId: string
  planYearName: string
  enrollmentWindowId: string | null
  enrollmentWindowName: string | null
  status: ElectionStatus
  planIds: string[]
  planNames: string | null
  submittedAt: string | null
  decidedByUserId: string | null
  decidedByName: string | null
  decidedAt: string | null
  remarks: string | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

/** Update Information: the details asked for (`POST /employees/{id}/update-requests`). */
export interface ProfileChanges {
  dateOfBirth?: string
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed'
  homeAddress?: string
}

export interface BenefitFile {
  /** The attachment's id (delete uses it). */
  id: string
  fileId: string
  fileName: string
  mimeType: string | null
  sizeBytes: number | null
  planId: string
  planName: string
  category: PlanCategory
  /** id, name and a signed link (expires). */
  file: FileRef | null
  createdAt: string
  rowVersion: string
}

// --- pickers ----------------------------------------------------------------------------------

/** A person from `GET /employees/lookup`. */
export interface LookupEmployee {
  id: string
  name: string
  jobTitle: string
  departmentId: string | null
  department: string
}

/** A department the people belong to (the enrollment window's "All Employees" filter). */
export interface LookupDepartment {
  id: string
  name: string
}

export interface LookupPlan {
  id: string
  name: string
  category: PlanCategory
}

export interface BenefitsLookups {
  planYears: PlanYear[]
  plans: BenefitPlan[]
  /** Everyone the lookup gives (every page). */
  employees: LookupEmployee[]
  departments: LookupDepartment[]
}
