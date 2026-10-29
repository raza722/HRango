import type { StandardKind } from './standard.types'

/**
 * Request types whose requester may never approve, reject or forward their own request, even
 * when a flow lists them as an approver: a person cannot promote themselves or accept their own
 * resignation. The server decides who may act; this keeps the buttons away from the requester.
 */
const NO_SELF_DECISION: ReadonlySet<StandardKind> = new Set(['promotion', 'resignation'])

/** The actions a requester must not get on their own request of such a type. */
export const SELF_BLOCKED_ACTIONS = ['decide', 'forward'] as const

/** True when this is the signed-in person's own request of a type they may not decide. */
export function isOwnUndecidable(
  kind: StandardKind,
  request: { employee: { id: string } } | undefined,
  myEmployeeId: string | null | undefined,
): boolean {
  if (!request || !myEmployeeId) return false
  return NO_SELF_DECISION.has(kind) && request.employee.id === myEmployeeId
}
