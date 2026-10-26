import type {
  ElectionStatus,
  ElectionUnit,
  NewHireStart,
  PlanCategory,
  WindowKind,
} from '@/features/benefits'

import { createMockCollection } from '../collection'
import {
  seedElections,
  seedFiles,
  seedPlans,
  seedPlanYears,
  seedUpdateRequests,
  seedWindows,
} from './seed'

// The mock's tables: what the database keeps. The handlers add the counts and names the API
// returns, as the procedures do.

interface Stamped {
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  rowVersion: string
}

export interface PlanYearRec extends Stamped {
  id: string
  name: string
  startDate: string
  endDate: string
  newHireStart: NewHireStart
  waitingPeriodDays: number | null
  electionPeriod: number
  electionUnit: ElectionUnit
  planIds: string[]
}

export interface PlanRec extends Stamped {
  id: string
  category: PlanCategory
  name: string
  planType: string | null
  planTypeRef: string | null
  carrier: string | null
  startDate: string
  endDate: string
  description: string | null
  status: 'active' | 'inactive'
}

export interface WindowRec extends Stamped {
  id: string
  name: string
  kind: WindowKind
  planYearId: string
  effectiveDate: string
  closesOn: string
  description: string | null
  planIds: string[]
  employeeIds: string[]
}

export interface ElectionRec extends Stamped {
  id: string
  employeeId: string
  planYearId: string
  enrollmentWindowId: string | null
  status: ElectionStatus
  planIds: string[]
  submittedAt: string | null
  decidedByName: string | null
  decidedAt: string | null
  remarks: string | null
}

/** A plan's attachment (core.attachment): its id is the attachment's. */
export interface FileRec {
  id: string
  fileId: string
  fileName: string
  mimeType: string | null
  sizeBytes: number | null
  planId: string
  createdAt: string
  rowVersion: string
}

/** An Update Information request (Employees module), as the Employees tab sends it. */
export interface UpdateRequestRec {
  id: string
  employeeId: string
  changes: Record<string, string>
  status: 'pending'
  createdAt: string
}

const key = (name: string) => `hrms-mock-benefits-v2-${name}`

export const planYears = createMockCollection<PlanYearRec>({
  storageKey: key('plan-years'),
  seed: seedPlanYears,
})
export const plans = createMockCollection<PlanRec>({ storageKey: key('plans'), seed: seedPlans })
export const enrollmentWindows = createMockCollection<WindowRec>({
  storageKey: key('windows'),
  seed: seedWindows,
})
export const elections = createMockCollection<ElectionRec>({
  storageKey: key('elections'),
  seed: seedElections,
})
export const planFiles = createMockCollection<FileRec>({
  storageKey: key('files'),
  seed: seedFiles,
})
export const updateRequests = createMockCollection<UpdateRequestRec>({
  storageKey: key('update-requests'),
  seed: seedUpdateRequests,
})

export function resetBenefitsCollections(): void {
  for (const collection of [
    planYears,
    plans,
    enrollmentWindows,
    elections,
    planFiles,
    updateRequests,
  ]) {
    collection.reset()
  }
}
