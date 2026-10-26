// Public API of the roster feature. Import from '@/features/roster', not from deep paths.
export {
  rosterApi,
  rosterGroupQueryOptions,
  rosterGroupsQueryOptions,
  rosterKeys,
  timeSlotOptionsQueryOptions,
} from './api/roster.api'
export { RosterGroupDetails } from './components/roster-group-details'
export { RosterPage } from './components/roster-page'
export { ROSTER_DAY_LABELS, ROSTER_PAGE_SIZE, ROSTER_PERMISSIONS } from './constants'
export { useEnrollEmployees, useRosterEnrollments } from './hooks/use-roster-enrollments'
export {
  useDeleteRosterGroup,
  useRosterGroup,
  useRosterGroups,
  useSaveRosterGroup,
  useSetRosterGroupStatus,
  useTimeSlotOptions,
} from './hooks/use-roster-groups'
export { ROSTER_DIALOGS, ROSTER_SEARCH_DEFAULTS, rosterSearchSchema } from './routing'
export { enrollmentFormSchema, type EnrollmentFormValues } from './schemas/enrollment-form.schema'
export {
  type RosterDayFormValues,
  rosterGroupFormSchema,
  type RosterGroupFormValues,
} from './schemas/roster-group-form.schema'
export * from './types/roster.types'
export {
  createDefaultRosterValues,
  toRosterFormValues,
  toRosterInput,
} from './utils/roster-mappers'
export { formatMinutes, isOvernight, shiftMinutes, toHhMm } from './utils/shift-time'
export { timeSlotSelectOptions } from './utils/time-slot-options'
