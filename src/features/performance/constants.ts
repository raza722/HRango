import type {
  AppraisalStatus,
  ChangeType,
  CycleStatus,
  GoalStatus,
  MeasureType,
  Outcome,
  ScopeTab,
} from './types/performance.types'

/**
 * Permission codes. The OpenAPI spec names none for `/performance…` (only the operation
 * titles: "List Goals", "Check In", "Launch Cycle" …); these follow the module.screen.action
 * pattern of Payroll and Talent Management and are assumptions until the catalogue confirms
 * them. In mock mode (no permissions list) everything shows. The server checks every call.
 * Seeing the pages at all is the sidebar's `performance` prefix (`navigation.ts`).
 */
export const PERF_CODES = {
  /** Pick another person on the Overview (managers, HR). */
  overviewOthers: 'performance.overview.view_team',
  goalsView: 'performance.goals.view',
  goalsTeam: 'performance.goals.view_team',
  goalsAll: 'performance.goals.view_all',
  goalsCreate: 'performance.goals.create',
  goalsEdit: 'performance.goals.edit',
  goalsDelete: 'performance.goals.delete',
  goalsCheckIn: 'performance.goals.check_in',
  kpisCreate: 'performance.kpis.create',
  kpisEdit: 'performance.kpis.edit',
  kpisDelete: 'performance.kpis.delete',
  cyclesCreate: 'performance.cycles.create',
  cyclesEdit: 'performance.cycles.edit',
  cyclesDelete: 'performance.cycles.delete',
  cyclesParticipants: 'performance.cycles.participants',
  cyclesLaunch: 'performance.cycles.launch',
  cyclesClose: 'performance.cycles.close',
  appraisalsView: 'performance.appraisals.view',
  appraisalsTeam: 'performance.appraisals.view_team',
  appraisalsAll: 'performance.appraisals.view_all',
  appraisalsDelete: 'performance.appraisals.delete',
  appraisalsFinalise: 'performance.appraisals.finalise',
  reviewsSelf: 'performance.reviews.self',
  reviewsManager: 'performance.reviews.manager',
  reviewsAll: 'performance.reviews.view_all',
} as const

/** Rows per page of the lists, and the choices. */
export const PERF_PAGE_SIZE = 10
export const PERF_PAGE_SIZES = [10, 20, 50] as const

export interface ChipMeta {
  label: string
  className: string
}

/*
 * Status chips in the palette of Leaves and Talent Management: green done, amber waiting on
 * the employee, orange waiting on the manager, sky in progress / reviewed, violet cancelled,
 * grey not started / draft, navy closed. Every chip carries its label, so no status is told
 * by colour alone.
 */
const GREEN = 'bg-[#2CBD4D]/[0.18] text-[#2E9E48] dark:bg-green-500/15 dark:text-green-400'
const AMBER = 'bg-[#FFF3D9] text-[#B7791F] dark:bg-amber-500/15 dark:text-amber-300'
const ORANGE = 'bg-[#FFEDE0] text-[#C2560C] dark:bg-orange-500/15 dark:text-orange-300'
const SKY = 'bg-[#E3F1FD] text-[#1D6FB8] dark:bg-sky-500/15 dark:text-sky-300'
const VIOLET = 'bg-[#EFE9FE] text-[#7C4DDB] dark:bg-violet-500/15 dark:text-violet-300'
const GREY = 'bg-[#EFEFEF] text-[#5C5C5C] dark:bg-muted dark:text-muted-foreground'
const NAVY = 'bg-[#EBEFF8] text-[#263871] dark:bg-indigo-500/15 dark:text-indigo-300'
const RED = 'bg-[#FFE3E3] text-[#C62828] dark:bg-red-500/15 dark:text-red-300'

export const GOAL_STATUS_META: Record<GoalStatus, ChipMeta> = {
  not_started: { label: 'Not Started', className: GREY },
  in_progress: { label: 'In Progress', className: SKY },
  completed: { label: 'Completed', className: GREEN },
  cancelled: { label: 'Cancelled', className: VIOLET },
}

export const OVERDUE_META: ChipMeta = { label: 'Overdue', className: RED }
export const LOCKED_META: ChipMeta = { label: 'Locked', className: GREY }

export const CYCLE_STATUS_META: Record<CycleStatus, ChipMeta> = {
  draft: { label: 'Draft', className: GREY },
  active: { label: 'Active', className: GREEN },
  closed: { label: 'Closed', className: NAVY },
}

export const APPRAISAL_STATUS_META: Record<AppraisalStatus, ChipMeta> = {
  draft: { label: 'Not Launched', className: GREY },
  self_review: { label: 'Self Review', className: AMBER },
  manager_review: { label: 'Manager Review', className: ORANGE },
  reviewed: { label: 'Reviewed', className: SKY },
  finalised: { label: 'Finalised', className: GREEN },
}

/**
 * An appraisal's chip: once its cycle is closed, an appraisal that was never finalised reads
 * "Closed" (nobody can review it any more), not the stage it stopped at.
 */
export function appraisalStatusMeta(appraisal: { status: string; cycleStatus: string }): ChipMeta {
  if (appraisal.cycleStatus === 'closed' && appraisal.status !== 'finalised') {
    return { label: 'Closed, not finalised', className: GREY }
  }
  return metaOf(APPRAISAL_STATUS_META, appraisal.status)
}

export const ACTIVE_META: Record<'active' | 'inactive', ChipMeta> = {
  active: { label: 'Active', className: GREEN },
  inactive: { label: 'Inactive', className: GREY },
}

/** A status the API sent that the screens do not know shows as it came. */
export function metaOf<T extends string>(table: Record<T, ChipMeta>, status: string): ChipMeta {
  return (table as Partial<Record<string, ChipMeta>>)[status] ?? { label: status, className: GREY }
}

export const SCOPE_LABELS: Record<ScopeTab, string> = { my: 'My', team: 'Team', all: 'All' }

export const MEASURE_LABELS: Record<MeasureType, string> = {
  percentage: 'Percentage',
  number: 'Number',
  amount: 'Amount',
  rating: 'Rating',
  yes_no: 'Yes / No',
}

export const OUTCOME_LABELS: Record<Outcome, string> = {
  no_change: 'No Change',
  increment: 'Increment',
  promotion: 'Promotion',
  improvement_plan: 'Improvement Plan',
}

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  flat: 'Flat amount',
  percent: 'Percentage',
}

/** Labels that look up a value, falling back to the value itself. */
export function labelOf<T extends string>(labels: Record<T, string>, value: string | null): string {
  if (!value) return ''
  return (labels as Partial<Record<string, string>>)[value] ?? value
}

/** The appraisal's stages in order, for the step tracker. */
export const APPRAISAL_STEPS: readonly { status: AppraisalStatus; label: string }[] = [
  { status: 'self_review', label: 'Self Review' },
  { status: 'manager_review', label: 'Manager Review' },
  { status: 'reviewed', label: 'Reviewed' },
  { status: 'finalised', label: 'Finalised' },
]
