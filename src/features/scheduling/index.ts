// Public API of the scheduling feature. Import from '@/features/scheduling', not from deep paths.
export { boardQueryOptions, schedulingApi, schedulingKeys } from './api/scheduling.api'
export { RestDayDialog } from './components/dialogs/rest-day-dialog'
export { EmployeeSelector, type SelectorFilter } from './components/fields/employee-selector'
export { SchedulingPage } from './components/scheduling-page'
export { useActiveShift, useScheduleBoard } from './hooks/use-scheduling'
export {
  SCHEDULING_SEARCH_DEFAULTS,
  type SchedulingSearch,
  schedulingSearchSchema,
} from './routing'
export {
  applyDefaultSchema,
  createScheduleSchema,
  type CreateScheduleValues,
  createStepOneSchema,
  deleteScheduleSchema,
  restDaySchema,
} from './schemas/schedule-forms.schema'
export * from './types/scheduling.types'
export { parseScheduleCsv, scheduleToCsv } from './utils/schedule-csv'
export {
  eachDay,
  formatRange,
  nextDay,
  periodRange,
  repeatDates,
  scheduleDates,
  weekBands,
  weekdayOf,
} from './utils/schedule-dates'
export { formatClock, formatHours, plannedMinutes, spanMinutes } from './utils/shift-hours'
