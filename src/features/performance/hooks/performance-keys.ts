import { compact } from '../api/performance.api'
import type {
  AppraisalListParams,
  CycleListParams,
  GoalListParams,
  KpiListParams,
} from '../types/performance.types'

/** Query keys of the Performance screens; every mutation invalidates `all`. */
export const performanceKeys = {
  all: ['performance'] as const,
  overview: (employeeId: string | undefined) =>
    [...performanceKeys.all, 'overview', employeeId ?? 'me'] as const,
  goals: () => [...performanceKeys.all, 'goals'] as const,
  goalList: (params: GoalListParams) =>
    [...performanceKeys.goals(), 'list', compact(params)] as const,
  goal: (id: string) => [...performanceKeys.goals(), 'detail', id] as const,
  kpis: () => [...performanceKeys.all, 'kpis'] as const,
  kpiList: (params: KpiListParams) => [...performanceKeys.kpis(), 'list', compact(params)] as const,
  kpi: (id: string) => [...performanceKeys.kpis(), 'detail', id] as const,
  cycles: () => [...performanceKeys.all, 'cycles'] as const,
  cycleList: (params: CycleListParams) =>
    [...performanceKeys.cycles(), 'list', compact(params)] as const,
  cycle: (id: string) => [...performanceKeys.cycles(), 'detail', id] as const,
  forms: () => [...performanceKeys.all, 'forms'] as const,
  appraisals: () => [...performanceKeys.all, 'appraisals'] as const,
  appraisalList: (params: AppraisalListParams) =>
    [...performanceKeys.appraisals(), 'list', compact(params)] as const,
  appraisal: (id: string) => [...performanceKeys.appraisals(), 'detail', id] as const,
  reviews: () => [...performanceKeys.all, 'reviews'] as const,
  reviewList: (params: AppraisalListParams) =>
    [...performanceKeys.reviews(), 'list', compact(params)] as const,
  review: (id: string) => [...performanceKeys.reviews(), 'detail', id] as const,
  /** Organisation pickers: outside `all`, so saving a goal does not refetch them. */
  org: (kind: 'departments' | 'job-titles') => ['performance-org', kind] as const,
}
