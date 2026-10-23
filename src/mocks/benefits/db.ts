import type {
  BenefitPlan,
  BenefitProfile,
  Election,
  EnrollmentWindow,
  PlanYear,
} from '@/features/benefits'

import { createMockCollection } from '../collection'
import {
  seedElections,
  seedEnrollmentWindows,
  seedPlans,
  seedPlanYears,
  seedProfiles,
} from './seed'

const key = (name: string) => `hrms-mock-benefits-${name}`

export const planYears = createMockCollection<PlanYear>({
  storageKey: key('plan-years'),
  seed: seedPlanYears,
})
export const plans = createMockCollection<BenefitPlan>({
  storageKey: key('plans'),
  seed: seedPlans,
})
export const enrollmentWindows = createMockCollection<EnrollmentWindow>({
  storageKey: key('windows'),
  seed: seedEnrollmentWindows,
})
export const elections = createMockCollection<Election>({
  storageKey: key('elections'),
  seed: seedElections,
})
export const profiles = createMockCollection<BenefitProfile>({
  storageKey: key('profiles'),
  seed: seedProfiles,
})

export function resetBenefitsDb(): void {
  for (const collection of [planYears, plans, enrollmentWindows, elections, profiles]) {
    collection.reset()
  }
}
