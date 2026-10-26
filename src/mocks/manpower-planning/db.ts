import type {
  BudgetStatus,
  OpenPositionStatus,
  PlanLineKind,
  PlanStatus,
  PositionStatus,
} from '@/features/manpower-planning'

import { createMockCollection } from '../collection'
import {
  seedBudgets,
  seedDurations,
  seedOpenPositions,
  seedPlans,
  seedPositions,
  seedRanges,
} from './seed'

// The mock's tables: what the database keeps. The handlers add the names and counts the API
// returns (`toDuration`, `toPlan` …), as the procedures do.

export interface DurationRec {
  id: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  rowVersion: string
}

export interface PositionRec {
  id: string
  code: string
  status: PositionStatus
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
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  updatedByName: string | null
  rowVersion: string
}

export interface RangeRec {
  id: string
  positionId: string
  effectiveDate: string
  minSalary: number
  maxSalary: number
  createdAt: string
  createdByName: string | null
  rowVersion: string
}

export interface LineRec {
  id: string
  kind: PlanLineKind
  positionId: string | null
  employeeId: string | null
  headcount: number
  startDate: string
  endDate: string
  minSalary: number | null
  maxSalary: number | null
  monthlySalary: number | null
  totalAllowance: number
  eBudgetId: string | null
}

export interface PlanRec {
  id: string
  title: string
  budgetDurationId: string
  divisionId: string | null
  branchId: string | null
  departmentId: string | null
  subDepartmentId: string | null
  employeeGroupId: string | null
  description: string | null
  status: PlanStatus
  submittedAt: string | null
  files: { id: string; name: string; mimeType: string | null; sizeBytes: number | null }[]
  lines: LineRec[]
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  updatedByName: string | null
  rowVersion: string
}

export interface BudgetRec {
  id: string
  title: string
  budgetDurationId: string
  manpowerPlanId: string | null
  jobTitleId: string | null
  departmentId: string | null
  amount: number
  totalPositions: number
  startDate: string
  endDate: string
  status: BudgetStatus
  decidedByName: string | null
  decidedAt: string | null
  remarks: string | null
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  rowVersion: string
}

export interface OpenRec {
  id: string
  title: string
  eBudgetId: string
  manpowerPlanLineId: string | null
  positionId: string | null
  jobTitleId: string | null
  departmentId: string | null
  branchId: string | null
  approvedPositions: number
  totalPositions: number
  endDate: string | null
  jdFile: { id: string; name: string; mimeType: string | null; sizeBytes: number | null } | null
  status: OpenPositionStatus
  approvedAt: string | null
  approvedByName: string | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

const key = (name: string) => `hrms-mock-manpower-v2-${name}`

export const durations = createMockCollection<DurationRec>({
  storageKey: key('durations'),
  seed: seedDurations,
})
export const positions = createMockCollection<PositionRec>({
  storageKey: key('positions'),
  seed: seedPositions,
})
export const salaryRanges = createMockCollection<RangeRec>({
  storageKey: key('ranges'),
  seed: seedRanges,
})
export const plans = createMockCollection<PlanRec>({ storageKey: key('plans'), seed: seedPlans })
export const budgets = createMockCollection<BudgetRec>({
  storageKey: key('budgets'),
  seed: seedBudgets,
})
export const openPositions = createMockCollection<OpenRec>({
  storageKey: key('open-positions'),
  seed: seedOpenPositions,
})

export function resetManpowerCollections(): void {
  for (const collection of [durations, positions, salaryRanges, plans, budgets, openPositions]) {
    collection.reset()
  }
}
