import {
  applyCancelDecision,
  applyCancelRequest,
  applyDecision,
  currentStep,
  historyEntry,
  planFlow,
  type StoredPunchRequest,
  type StoredRequest,
  type StoredStep,
} from './flow'

/** A stored transfer request: the shared request fields plus where the person moves. */
export type StoredTransferRequest = Omit<StoredPunchRequest, 'kind' | 'payload' | 'applied'> & {
  kind: 'transfer'
  payload: {
    /** Where the person worked when they asked. */
    fromLocationId: string | null
    fromBranchId: string | null
    fromDepartment: string
    locationId: string
    branchId: string
    department: string
    lineManagerId: string
    finalAuthorityId: string
    effectiveDate: string
    attachmentName: string | null
    description: string
    application: string
  }
  /** Approval records the move in the transfer log (see effects.ts); nothing to undo here. */
  applied: null
}

export type AnyStoredRequest = StoredRequest | StoredTransferRequest

export function stepOf(record: AnyStoredRequest): StoredStep | null {
  return currentStep(record)
}

/**
 * A fresh transfer request through the Transfer flow (Requests → Settings;
 * by default Line Manager, then HR Manager), with "Requested" in its history.
 */
export function newTransferRecord(
  base: Pick<StoredTransferRequest, 'id' | 'code' | 'employeeId' | 'createdById' | 'payload'>,
  at: string,
): StoredTransferRequest {
  const { department, locationId, branchId, effectiveDate } = base.payload
  const plan = planFlow(base.employeeId, 'transfer', {
    department,
    locationId,
    branchId,
    effectiveDate,
  })
  return {
    ...base,
    kind: 'transfer',
    status: 'pending',
    flow: plan.steps,
    consents: plan.consentIds.map((personId) => ({ personId, status: 'pending', remarks: null })),
    cancelReason: null,
    cancelStep: null,
    history: [
      historyEntry(base.createdById, 'Requested', null, at),
      ...plan.lookerIds.map((personId) => historyEntry(personId, 'Informed (On Looker)', null, at)),
    ],
    applied: null,
    createdAt: at,
    updatedAt: at,
  }
}

export function decideTransfer(
  record: StoredTransferRequest,
  decision: 'approve' | 'reject',
  actorId: string,
  remarks: string | null,
  at: string,
): { record: StoredTransferRequest; completed: boolean } {
  return applyDecision(record, decision, actorId, remarks, at)
}

export function requestTransferCancel(
  record: StoredTransferRequest,
  actorId: string,
  reason: string,
  at: string,
): StoredTransferRequest {
  return applyCancelRequest(record, actorId, reason, at)
}

export function decideTransferCancel(
  record: StoredTransferRequest,
  decision: 'approve' | 'reject',
  actorId: string,
  remarks: string | null,
  at: string,
): StoredTransferRequest {
  return applyCancelDecision(record, decision, actorId, remarks, at)
}
