import { createMockCollection } from '../collection'
import {
  type AppraisalRec,
  type CycleRec,
  type FormRec,
  type GoalRec,
  type KpiRec,
  type ScaleRec,
  seedAppraisals,
  seedCycles,
  seedForms,
  seedGoals,
  seedKpis,
  seedScales,
} from './seed'

// The Performance mock's tables, kept in sessionStorage in the browser like every mock.

const key = (name: string) => `hrms-mock-performance-${name}`

export const ratingScales = createMockCollection<ScaleRec>({
  storageKey: key('scales'),
  seed: seedScales,
})
export const appraisalForms = createMockCollection<FormRec>({
  storageKey: key('forms'),
  seed: seedForms,
})
export const kpis = createMockCollection<KpiRec>({ storageKey: key('kpis'), seed: seedKpis })
export const cycles = createMockCollection<CycleRec>({
  storageKey: key('cycles'),
  seed: seedCycles,
})
export const goals = createMockCollection<GoalRec>({ storageKey: key('goals'), seed: seedGoals })
export const appraisals = createMockCollection<AppraisalRec>({
  storageKey: key('appraisals'),
  seed: () => seedAppraisals(),
})

/** Restores every Performance table to its seed data (used between tests). */
export function resetPerformanceTables(): void {
  ratingScales.reset()
  appraisalForms.reset()
  kpis.reset()
  cycles.reset()
  goals.reset()
  appraisals.reset()
}
