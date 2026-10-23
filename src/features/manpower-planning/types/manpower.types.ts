// Manpower Planning: budget durations, position titles and employee positions (E-Budget
// Settings), plans with their new and existing positions (Planning), the budgets a plan
// asks for (E-Budgeting), their approval (Budget Approvals) and the open positions an
// approved budget opens (Open Positions).

/** "16 Jan 2024 12:30 PM by Hamza Ashraf, HR Manager": when and by whom. */
export interface Stamp {
  at: string
  byName: string
  byRole: string
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
  /** `yyyy-MM-dd`. */
  startDate: string
  endDate: string
  isCurrent: boolean
  added: Stamp
}

export interface BudgetDurationInput {
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
}

export interface PositionTitle {
  id: string
  title: string
  active: boolean
  added: Stamp
  modified: Stamp
}

export interface PositionTitleInput {
  title: string
}

export interface EmployeePosition {
  id: string
  code: string
  positionTitleId: string
  divisionId: string | null
  stationId: string | null
  departmentId: string | null
  subDepartmentId: string | null
  employeeGroupId: string
  costCenterId: string | null
  gradeId: string | null
  reportsToId: string | null
  minSalary: number
  maxSalary: number
  active: boolean
  added: Stamp
  modified: Stamp
}

export interface EmployeePositionRow extends EmployeePosition {
  positionTitle: string
}

export interface EmployeePositionInput {
  /** Blank: the next free number is given. */
  code: string
  positionTitleId: string
  divisionId: string | null
  stationId: string
  departmentId: string | null
  subDepartmentId: string | null
  employeeGroupId: string
  costCenterId: string | null
  gradeId: string | null
  reportsToId: string | null
  minSalary: number
  maxSalary: number
}

/** One line of an Upload Excel file, by names. */
export interface EmployeePositionImportRow {
  code: string
  positionTitle: string
  division: string
  station: string
  department: string
  subDepartment: string
  employeeGroup: string
  costCenter: string
  grade: string
  reportsTo: string
  minSalary: number
  maxSalary: number
}

export interface ImportResult {
  created: number
  errors: string[]
}

// --- Planning ---------------------------------------------------------------------------------

export const PLAN_STATUSES = ['approved', 'pending', 'rejected'] as const
export type PlanStatus = (typeof PLAN_STATUSES)[number]

/** "New": the plan has new positions; "Existing": it plans existing ones. */
export const PLAN_MODES = ['new', 'existing'] as const
export type PlanMode = (typeof PLAN_MODES)[number]

export interface NewPositionLine {
  id: string
  /** The Employee Position planned. */
  positionId: string
  /** `yyyy-MM`: the months the position is budgeted for. */
  fromMonth: string
  toMonth: string
  divisionId: string | null
  stationId: string | null
  departmentId: string | null
  subDepartmentId: string | null
  employeeGroupId: string | null
  minSalary: number
  maxSalary: number
  totalAllowance: number
}

export interface ExistingPositionLine {
  id: string
  employeeId: string
  /** `yyyy-MM-dd`. */
  startDate: string
  endDate: string
  monthlySalary: number
  totalAllowance: number
}

export interface Plan {
  id: string
  title: string
  durationId: string
  divisionId: string | null
  stationId: string | null
  departmentId: string | null
  subDepartmentId: string | null
  employeeGroupId: string | null
  description: string
  newPositions: NewPositionLine[]
  existingPositions: ExistingPositionLine[]
  status: PlanStatus
  added: Stamp
  modified: Stamp
}

export type PlanInput = Omit<Plan, 'id' | 'status' | 'added' | 'modified'>

export interface PlanRow {
  id: string
  title: string
  monthlyAmount: number
  annualAmount: number
  durationId: string
  planningYear: string
  /** The plan year is the current budget duration. */
  isCurrent: boolean
  status: PlanStatus
  modes: PlanMode[]
  added: Stamp
  /** Approved budgets cannot change, so neither can their plan. */
  locked: boolean
}

export interface PlanDetail extends Plan {
  planningYear: string
  monthlyAmount: number
  annualAmount: number
  locked: boolean
  budgets: BudgetRow[]
}

// --- E-Budgeting and Budget Approvals ---------------------------------------------------------

/** `active`: approved and in force (the designs' green "Active"). */
export const BUDGET_STATUSES = ['pending', 'active', 'rejected'] as const
export type BudgetStatus = (typeof BUDGET_STATUSES)[number]

export interface Budget {
  id: string
  planId: string | null
  /** The position the money is for ("Accounts"). */
  title: string
  durationId: string
  amount: number
  startDate: string
  endDate: string
  /** New positions it opens once approved. */
  positions: number
  status: BudgetStatus
  added: Stamp
  /** Who approved or rejected it, and when. */
  decided: Stamp | null
}

export interface BudgetRow extends Budget {
  duration: string
  planTitle: string | null
}

export interface BudgetInput {
  amount: number
  startDate: string
  endDate: string
}

// --- Open Positions ---------------------------------------------------------------------------

export const OPEN_POSITION_STATUSES = ['active', 'closed'] as const
export type OpenPositionStatus = (typeof OPEN_POSITION_STATUSES)[number]

export interface OpenPosition {
  id: string
  budgetId: string | null
  title: string
  totalPositions: number
  endDate: string
  approved: Stamp
  status: OpenPositionStatus
}

export interface OpenPositionInput {
  totalPositions: number
  endDate: string
}

export interface JobDescription {
  fileName: string
  text: string
}

// --- Lookups ----------------------------------------------------------------------------------

export interface DepartmentOption extends NamedOption {
  divisionId: string
}

export interface SubDepartmentOption extends NamedOption {
  departmentId: string
}

export interface EmployeeOption {
  id: string
  name: string
  jobTitle: string
  departmentId: string | null
  stationId: string | null
  /** Monthly gross today (Payroll). */
  salary: number
}

export interface PositionOption {
  id: string
  code: string
  title: string
  positionTitleId: string
  divisionId: string | null
  stationId: string | null
  departmentId: string | null
  subDepartmentId: string | null
  employeeGroupId: string
  minSalary: number
  maxSalary: number
  active: boolean
}

export interface ManpowerLookups {
  divisions: NamedOption[]
  stations: NamedOption[]
  departments: DepartmentOption[]
  subDepartments: SubDepartmentOption[]
  employeeGroups: NamedOption[]
  grades: NamedOption[]
  costCenters: NamedOption[]
  employees: EmployeeOption[]
  durations: BudgetDuration[]
  positionTitles: { id: string; title: string; active: boolean }[]
  positions: PositionOption[]
}

export interface ListParams {
  page: number
  pageSize: number
}
