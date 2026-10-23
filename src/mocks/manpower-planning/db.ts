import type {
  Budget,
  BudgetDuration,
  EmployeePosition,
  OpenPosition,
  Plan,
  PositionTitle,
} from '@/features/manpower-planning'

import { createMockCollection } from '../collection'
import {
  seedBudgets,
  seedDurations,
  seedOpenPositions,
  seedPlans,
  seedPositions,
  seedPositionTitles,
} from './seed'

const key = (name: string) => `hrms-mock-manpower-${name}`

export const durations = createMockCollection<BudgetDuration>({
  storageKey: key('durations'),
  seed: seedDurations,
})
export const positionTitles = createMockCollection<PositionTitle>({
  storageKey: key('position-titles'),
  seed: seedPositionTitles,
})
export const positions = createMockCollection<EmployeePosition>({
  storageKey: key('positions'),
  seed: seedPositions,
})
export const plans = createMockCollection<Plan>({ storageKey: key('plans'), seed: seedPlans })
export const budgets = createMockCollection<Budget>({
  storageKey: key('budgets'),
  seed: seedBudgets,
})
export const openPositions = createMockCollection<OpenPosition>({
  storageKey: key('open-positions'),
  seed: seedOpenPositions,
})

export function resetManpowerCollections(): void {
  for (const collection of [durations, positionTitles, positions, plans, budgets, openPositions]) {
    collection.reset()
  }
}
