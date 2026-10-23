// Benefits Management: plan years, the plan catalogue, enrollment windows, employee elections.

/** The card's sub menu, one route each under /benefits. */
export type BenefitsTab = 'plan-years' | 'plans' | 'enrollment-windows' | 'employees' | 'files'

/** The plan year row menu. */
export type PlanYearAction = 'edit' | 'delete' | 'open-enrollment' | 'new-hire' | 'life-event'

/** The Add New Plan menu's categories, in its order. */
export type PlanCategory =
  'medical' | 'dental' | 'vision' | 'retirement' | 'hsa' | 'life' | 'others'

/** "When can new hires start their benefits enrollment?" */
export type NewHireStart = 'immediately' | 'waiting-period' | 'per-employee'

/** "How long do new employees have to complete elections?" unit. */
export type ElectionUnit = 'day' | 'week' | 'month'

/** Where an employee's elections for a plan year stand. */
export type ElectionStatus = 'pending' | 'approved' | 'incomplete' | 'waived'

/** A plan year by its dates: before, during or after. */
export type PlanYearStatus = 'upcoming' | 'active' | 'ended'

/** An enrollment window until and after its last day. */
export type WindowStatus = 'open' | 'closed'

// --- stored records (mock tables) ---------------------------------------------------------------

export interface PlanYear {
  id: string
  name: string
  /** yyyy-MM-dd */
  startDate: string
  /** yyyy-MM-dd */
  endDate: string
  /** The plans offered this year. */
  planIds: string[]
  newHireStart: NewHireStart
  electionPeriod: number
  electionUnit: ElectionUnit
  createdAt: string
}

export interface BenefitPlan {
  id: string
  category: PlanCategory
  name: string
  planType: string
  planTypeId: string
  carrier: string
  startDate: string
  endDate: string
  /** The attachment's file name (the mock keeps no file contents). */
  attachmentName: string
  attachmentSize: number
  /** Who may enrol (the Eligibility & Cost step; every plan is Full-Time for now). */
  eligibility: string
  createdAt: string
}

export interface EnrollmentWindow {
  id: string
  name: string
  planYearId: string
  /** "When will this plan within this window become effective?" */
  effectiveDate: string
  /** "When can employee complete their enrollment?" (the last day). */
  enrollmentEndDate: string
  planIds: string[]
  employeeIds: string[]
  createdAt: string
}

export interface Election {
  id: string
  employeeId: string
  planYearId: string
  planIds: string[]
  status: ElectionStatus
}

/** The details benefits enrollment needs from each person. */
export interface BenefitProfile {
  /** The employee id. */
  id: string
  dateOfBirth: string | null
  maritalStatus: string | null
  homeAddress: string | null
}

// --- API shapes ---------------------------------------------------------------------------------

export interface BenefitsSummary {
  employees: number
  planYears: number
  plans: number
  enrollmentWindows: number
}

export interface LookupEmployee {
  id: string
  name: string
  jobTitle: string
  department: string
}

export interface LookupPlan {
  id: string
  name: string
  category: PlanCategory
}

export interface LookupPlanYear {
  id: string
  name: string
  startDate: string
  endDate: string
  planIds: string[]
}

export interface BenefitsLookups {
  planYears: LookupPlanYear[]
  plans: LookupPlan[]
  employees: LookupEmployee[]
  departments: string[]
  carriers: string[]
}

export interface PlanYearRow extends PlanYear {
  status: PlanYearStatus
  pending: number
  approved: number
  incomplete: number
  /** People whose benefit details are not complete. */
  missingInformation: number
}

export interface PlanYearInput {
  name: string
  startDate: string
  endDate: string
  planIds: string[]
  newHireStart: NewHireStart
  electionPeriod: number
  electionUnit: ElectionUnit
}

export interface PlanRow extends BenefitPlan {
  enrolled: number
  notEnrolled: number
}

export interface PlanInput {
  category: PlanCategory
  name: string
  planType: string
  planTypeId: string
  carrier: string
  startDate: string
  endDate: string
  attachmentName: string
  attachmentSize: number
}

export interface EnrollmentWindowRow extends EnrollmentWindow {
  planYearName: string
  status: WindowStatus
}

export interface EnrollmentWindowInput {
  name: string
  planYearId: string
  effectiveDate: string
  enrollmentEndDate: string
  planIds: string[]
  employeeIds: string[]
}

export interface EmployeeElection {
  planYearId: string
  planYearName: string
  /** `null`: nothing started yet. */
  status: ElectionStatus | null
}

export interface EmployeeRow {
  id: string
  name: string
  jobTitle: string
  department: string
  elections: EmployeeElection[]
  /** Labels of the missing details ("Date of Birth" …). */
  missing: string[]
  profile: BenefitProfile
}

export interface BenefitProfileInput {
  dateOfBirth: string
  maritalStatus: string
  homeAddress: string
}

export interface BenefitFileRow {
  id: string
  fileName: string
  size: number
  planId: string
  planName: string
  category: PlanCategory
  addedOn: string
}
