/** Legacy (kept for the barrel): History rows are audit-log lines of policies; there is no separate penalty entity. */
export const HISTORY_ENTITIES = ['policy', 'penalty'] as const
/** Legacy (kept for the barrel): See {@link HISTORY_ENTITIES}. */
export type HistoryEntity = (typeof HISTORY_ENTITIES)[number]

/** `actionName` values the audit log writes. */
export const HISTORY_ACTIONS = ['create', 'update', 'delete'] as const
export type HistoryAction = (typeof HISTORY_ACTIONS)[number]

/**
 * One audit-log line of the Warning module (`GET /warning/history`, `HistoryOut`). Penalties are
 * saved with their policy, so a penalty change is an `update` of the policy's `penalties` field.
 */
export interface WarningHistoryEntry {
  id: string
  /** UTC date-time without a zone (`2026-10-26T05:22:44`); see `parseServerTime`. */
  performedAt: string | null
  actionName: string | null
  policyId: string | null
  /** The policy's current title (null once it is deleted). */
  policyTitle: string | null
  /** Column that changed (`title`, `applies_to`, `rules`, `penalties` …). */
  fieldName: string | null
  oldValue: string | null
  newValue: string | null
  performedByUserId: string | null
  performedByName: string | null
}
