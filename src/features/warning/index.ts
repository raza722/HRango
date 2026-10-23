// Public API of the warning feature. Import from '@/features/warning', not from deep paths.
export {
  warningHistoryApi,
  warningHistoryKeys,
  warningHistoryQueryOptions,
} from './api/warning-history.api'
export {
  warningPenaltiesQueryOptions,
  warningPenaltyApi,
  warningPenaltyKeys,
  warningPenaltyQueryOptions,
} from './api/warning-penalty.api'
export { warningPolicyApi } from './api/warning-policy.api'
export {
  warningPoliciesQueryOptions,
  warningPolicyKeys,
  warningPolicyQueryOptions,
} from './api/warning-policy.queries'
export { HistoryDialog } from './components/history/history-dialog'
export { WarningOverviewPage } from './components/overview/warning-overview-page'
export { PenaltyPage } from './components/penalty/penalty-page'
export { PolicyDetailPage } from './components/policy-detail-page'
export { PolicyPage } from './components/policy-page'
export { POLICY_NAME_LABELS, TIME_SPAN_TABLE_LABELS } from './constants'
export { usePenaltyForm } from './hooks/use-penalty-form'
export { usePolicyForm } from './hooks/use-policy-form'
export {
  useClearHistory,
  useDeleteHistoryEntry,
  useWarningHistory,
} from './hooks/use-warning-history'
export {
  useCreateWarningPenalty,
  useDeleteWarningPenalty,
  useUpdateWarningPenalty,
  useWarningPenalties,
  useWarningPenalty,
} from './hooks/use-warning-penalties'
export { useWarningPolicies, useWarningPolicy } from './hooks/use-warning-policies'
export {
  useCreateWarningPolicy,
  useDeleteWarningPolicy,
  useUpdateWarningPolicy,
} from './hooks/use-warning-policy-mutations'
export {
  type PenaltyFormRule,
  penaltyFormSchema,
  type PenaltyFormValues,
} from './schemas/penalty-form.schema'
export {
  type PolicyFormPeriod,
  policyFormSchema,
  type PolicyFormValues,
} from './schemas/policy-form.schema'
export { usePolicyTablePrefs } from './store/policy-table-prefs.store'
export {
  resetWarningViewPrefs,
  useWarningViewPrefs,
  WARNING_TABLE_COLUMNS,
  type WarningTableId,
} from './store/warning-view-prefs.store'
export {
  HISTORY_ACTIONS,
  HISTORY_ENTITIES,
  type HistoryAction,
  type HistoryEntity,
  type WarningHistoryEntry,
} from './types/warning-history.types'
export {
  BADGE_COLORS,
  type BadgeColor,
  type Deduction,
  DEDUCTIONS,
  PENALTY_TYPES,
  type PenaltyRule,
  type PenaltyType,
  SCALE_TYPES,
  type ScaleType,
  type WarningPenalty,
  type WarningPenaltyInput,
} from './types/warning-penalty.types'
export {
  CLOCK_EVENTS,
  type ClockEvent,
  POLICY_NAMES,
  type PolicyName,
  type PolicyPeriod,
  TIME_SPANS,
  type TimeSpan,
  type WarningPolicy,
  type WarningPolicyInput,
  type Weekday,
  WEEKDAYS,
} from './types/warning-policy.types'
