export const HISTORY_ENTITIES = ['policy', 'penalty'] as const
export type HistoryEntity = (typeof HISTORY_ENTITIES)[number]

export const HISTORY_ACTIONS = ['created', 'updated', 'deleted'] as const
export type HistoryAction = (typeof HISTORY_ACTIONS)[number]

/** One audit-log line in the Warning module's History dialog. */
export interface WarningHistoryEntry {
  id: string
  /** ISO timestamp. */
  occurredAt: string
  entity: HistoryEntity
  action: HistoryAction
  /** Id of the policy or penalty the change was made to. */
  recordId: string
  /** Its title at the time of the change. */
  recordTitle: string
  /** Who made the change. */
  actor: string
}
