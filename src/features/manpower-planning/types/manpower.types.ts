// Manpower Planning, as the API (`/manpower/*`) returns it: budget durations, position titles
// (Organisation's job titles) and employee positions with their salary ranges (E-Budget
// Settings), plans with their new-position and existing-employee lines (Planning), the budgets a
// plan asks for (E-Budgeting), their approval (Budget Approvals) and the open positions an
// approved budget releases (Open Positions). Ids are strings; dates `yyyy-MM-dd`; times ISO.

import type { FileRef } from '@/lib/files'

/** "16 Jan 2024 12:30 PM by Hamza Ashraf": when and by whom. */
export interface Stamp {
  at: string
  byName: string | null
}

export interface NamedOption {
  id: string
  name: string
}

// --- E-Budget Settings ------------------------------------------------------------------------

export interface BudgetDuration {
  id: string
  /** "2024", "2024-2025". */
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
  planCount: number
  budgetCount: number
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  rowVersion: string
}

export interface BudgetDurationInput {
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
  rowVersion?: string | undefined
}

/** A position title is Organisation's job title, listed with how much it is used. */
export interface PositionTitle {
  id: string
  name: string
  positionCount: number
  activePositionCount: number
  openPositionCount: number
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
}

export const POSITION_STATUSES = ['active', 'inactive'] as const
export type PositionStatus = (typeof POSITION_STATUSES)[number]

export interface EmployeePosition {
  id: string
  code: string
  status: PositionStatus
  jobTitleId: string
  jobTitleName: string
  /** The station. */
  branchId: string
  branchName: string
  employeeGroupId: string
  employeeGroupName: string
  divisionId: string | null
  divisionName: string | null
  departmentId: string | null
  departmentName: string | null
  subDepartmentId: string | null
  subDepartmentName: string | null
  costCenterId: string | null
  costCenterName: string | null
  gradeId: string | null
  gradeName: string | null
  /** The position this one reports to. */
  reportsToId: string | null
  reportsToCode: string | null
  reportsToTitle: string | null
  /** The person holding the seat, if any. */
  employeeId: string | null
  employeeName: string | null
  /** The band in force today. */
  minSalary: number | null
  maxSalary: number | null
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  updatedByName: string | null
  rowVersion: string
}

export interface EmployeePositionInput {
  /** Blank: the next POS-0001 number is given. */
  code: string | null
  jobTitleId: string
  branchId: string
  employeeGroupId: string
  divisionId: string | null
  departmentId: string | null
  subDepartmentId: string | null
  costCenterId: string | null
  gradeId: string | null
  reportsToId: string | null
  employeeId: string | null
  status: PositionStatus
  minSalary: number
  maxSalary: number
  rowVersion?: string | undefined
}

/** One line of an Upload Excel sheet, by names, as `POST /positions/import` reads it. */
export interface EmployeePositionImportRow {
  code: string | null
  positionTitle: string | null
  station: string | null
  employeeGroup: string | null
  division: string | null
  department: string | null
  subDepartment: string | null
  costCenter: string | null
  grade: string | null
  reportsTo: string | null
  minSalary: string | null
  maxSalary: string | null
}

export interface ImportError {
  /** 1-based, among the rows sent. */
  rowNo: number
  field: string | null
  message: string
}

export interface ImportResult {
  created: number
  errors: ImportError[]
}

/** A position's band from a date on (the history of its salary range). */
export interface SalaryRange {
  id: string
  positionId: string
  effectiveDate: string
  minSalary: number
  maxSalary: number
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  rowVersion: string
}

export interface SalaryRangeInput {
  effectiveDate: string
  minSalary: number
  maxSalary: number
}

// --- Planning ---------------------------------------------------------------------------------

export const PLAN_STATUSES = ['approved', 'pending', 'rejected'] as const
export type PlanStatus = (typeof PLAN_STATUSES)[number]

/** "New": the plan has new positions; "Existing": it plans existing employees. */
export const PLAN_MODES = ['new', 'existing'] as const
export type PlanMode = (typeof PLAN_MODES)[number]

export type PlanLineKind = 'new_position' | 'existing_employee'

/** A plan as the list shows it. */
export interface Plan {
  id: string
  title: string
  budgetDurationId: string
  budgetDurationName: string
  /** The plan year is the current budget duration. */
  isCurrent: boolean
  divisionId: string | null
  divisionName: string | null
  /** The station. */
  branchId: string | null
  branchName: string | null
  departmentId: string | null
  departmentName: string | null
  subDepartmentId: string | null
  subDepartmentName: string | null
  employeeGroupId: string | null
  employeeGroupName: string | null
  description: string | null
  monthlyAmount: number
  annualAmount: number
  status: PlanStatus
  submittedAt: string | null
  hasNewPositions: boolean
  hasExistingPositions: boolean
  budgetCount: number
  approvedBudgetCount: number
  /** An approved budget locks the plan: no edit, no delete. */
  isLocked: boolean
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  updatedByName: string | null
  rowVersion: string
}

export interface PlanLine {
  id: string
  kind: PlanLineKind
  sortOrder: number | null
  positionId: string | null
  positionCode: string | null
  jobTitleName: string | null
  employeeId: string | null
  employeeCode: string | null
  employeeName: string | null
  departmentName: string | null
  branchName: string | null
  headcount: number
  startDate: string
  endDate: string
  months: number
  minSalary: number | null
  maxSalary: number | null
  monthlySalary: number | null
  totalAllowance: number
  /** A month of the line. */
  totalSalary: number
  annualGross: number
  eBudgetId: string | null
}

/** A file attached to a plan. */
export interface PlanFile {
  attachmentId: string
  id: string
  name: string
  mimeType: string | null
  sizeBytes: number | null
  createdAt: string
  /** Signed link (expires). */
  url: string
}

export interface PlanDetail extends Plan {
  lines: PlanLine[]
  budgets: Budget[]
  files: PlanFile[]
}

export interface PlanLineInput {
  kind: PlanLineKind
  positionId?: string | undefined
  employeeId?: string | undefined
  headcount?: number | undefined
  startDate: string
  endDate: string
  /** New positions: blank takes the position's band. */
  minSalary?: number | undefined
  maxSalary?: number | undefined
  /** Existing employees: blank takes the current salary. */
  monthlySalary?: number | undefined
  totalAllowance?: number | undefined
}

export interface PlanInput {
  title: string
  budgetDurationId: string
  divisionId: string | null
  branchId: string | null
  departmentId: string | null
  subDepartmentId: string | null
  employeeGroupId: string | null
  description: string | null
  lines: PlanLineInput[]
  /** The uploads of the plan; the list replaces its files. */
  fileIds: string[]
  rowVersion?: string | undefined
}

// --- E-Budgeting and Budget Approvals ---------------------------------------------------------

/** `approved` is drawn as the designs' green "Active". */
export const BUDGET_STATUSES = ['pending', 'approved', 'rejected'] as const
export type BudgetStatus = (typeof BUDGET_STATUSES)[number]

export interface Budget {
  id: string
  /** The position the money is for ("Accounts"). */
  title: string
  budgetDurationId: string
  budgetDurationName: string
  manpowerPlanId: string | null
  planTitle: string | null
  jobTitleId: string | null
  jobTitleName: string | null
  departmentId: string | null
  departmentName: string | null
  amount: number
  /** New positions it opens once approved. */
  totalPositions: number
  startDate: string
  endDate: string
  status: BudgetStatus
  decidedByUserId: string | null
  decidedByName: string | null
  decidedAt: string | null
  remarks: string | null
  openPositionCount: number
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  rowVersion: string
}

export interface BudgetInput {
  /** Blank: the position title's name. */
  title: string | null
  budgetDurationId: string
  jobTitleId: string | null
  departmentId: string | null
  amount: number
  totalPositions: number
  startDate: string
  endDate: string
  rowVersion?: string | undefined
}

// --- Open Positions ---------------------------------------------------------------------------

export const OPEN_POSITION_STATUSES = ['active', 'closed'] as const
export type OpenPositionStatus = (typeof OPEN_POSITION_STATUSES)[number]

export interface OpenPosition {
  id: string
  title: string
  eBudgetId: string
  budgetTitle: string
  manpowerPlanId: string | null
  planTitle: string | null
  manpowerPlanLineId: string | null
  positionId: string | null
  positionCode: string | null
  jobTitleId: string | null
  jobTitleName: string | null
  departmentId: string | null
  departmentName: string | null
  branchId: string | null
  branchName: string | null
  approvedPositions: number
  totalPositions: number
  endDate: string | null
  jdFileId: string | null
  /** The JD: id, name and a signed link (expires). */
  jdFile: FileRef | null
  status: OpenPositionStatus
  approvedAt: string | null
  approvedByName: string | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface OpenPositionInput {
  totalPositions: number
  endDate: string | null
  jdFileId: string | null
  rowVersion: string
}

/** `GET /open-positions/{id}/jd`: the JD with a fresh signed link. */
export interface JobDescription {
  id: string
  name: string
  mimeType: string | null
  sizeBytes: number | null
  createdAt: string
  url: string
}

// --- Lookups ----------------------------------------------------------------------------------

/** An Organisation department; a sub-department is a department with a parent. */
export interface DepartmentOption extends NamedOption {
  parentId: string | null
}

/** A person from `GET /employees/lookup`. */
export interface EmployeeOption {
  id: string
  code: string
  name: string
  jobTitleName: string | null
  departmentId?: string | null
  departmentName: string | null
  branchId?: string | null
  branchName: string
}

/** What the forms pick from (Organisation's lists, the durations and the positions). */
export interface ManpowerLookups {
  divisions: NamedOption[]
  /** Branches. */
  stations: NamedOption[]
  departments: DepartmentOption[]
  employeeGroups: NamedOption[]
  grades: NamedOption[]
  costCenters: NamedOption[]
  /** Organisation's job titles. */
  jobTitles: NamedOption[]
  durations: BudgetDuration[]
  positions: EmployeePosition[]
}

export interface ListParams {
  page: number
  pageSize: number
}
