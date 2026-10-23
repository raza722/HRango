import {
  FLOW_NODE_LABELS,
  type FlowAuthority,
  type FlowNode,
  type FlowRequestType,
  type FlowStepStatus,
  type RequestStatus,
  type SettingsRequestType,
} from '@/features/requests'
import type { ScheduleEntry } from '@/features/scheduling'

import type { DirectoryEmployee } from '../employees/seed'
import { branches } from '../settings/handlers'
import { createId } from '../utils'
import {
  departmentHeadOf,
  headOfDepartment,
  hrManagerFor,
  lineManagerOf,
  mustFind,
  TOP_MANAGER,
} from './people'
import { authoritiesOf, flowDefinition } from './settings-db'

export interface StoredStep {
  authority: string
  approverId: string
  status: FlowStepStatus
  actedById: string | null
  actedAt: string | null
  remarks: string | null
}

export interface StoredConsent {
  personId: string
  status: 'pending' | 'given' | 'declined'
  remarks: string | null
}

export interface StoredHistory {
  id: string
  byId: string
  delegate: boolean
  status: string
  remarks: string | null
  at: string
}

/** What an approval changed, so a cancellation can put it back. */
export type AppliedEffect =
  | { type: 'punch'; punchId: string }
  | { type: 'schedule'; before: { employeeId: string; entry: ScheduleEntry | null }[] }

interface StoredBase {
  id: string
  code: string
  status: RequestStatus
  employeeId: string
  createdById: string
  createdAt: string
  updatedAt: string
  flow: StoredStep[]
  consents: StoredConsent[]
  cancelReason: string | null
  /** The final authority deciding a cancellation. */
  cancelStep: StoredStep | null
  history: StoredHistory[]
  applied: AppliedEffect | null
}

export interface StoredPunchRequest extends StoredBase {
  kind: 'punch'
  payload: {
    date: string
    punchType: 'check-in' | 'check-out' | 'missing-punch'
    punchTime: string
    description: string
  }
}

export interface StoredShiftRequest extends StoredBase {
  kind: 'shift'
  payload: {
    date: string
    rosterGroupId: string | null
    rosterTitle: string | null
    swapFrom: string | null
    swapWithId: string | null
    swapToShift: string | null
    description: string
  }
}

export type StoredRequest = StoredPunchRequest | StoredShiftRequest

/** What the approval steps read and write: the fields every request kind shares. */
export type FlowRecord = StoredBase & { kind: string }

/** Facts a flow condition can test, e.g. `punchType == missing-punch` or `days > 3`. */
export type FlowFacts = Record<string, string | number | boolean | null>

/** Who a request goes to: approval steps, consents asked and on-lookers told. */
export interface FlowPlan {
  steps: StoredStep[]
  consentIds: string[]
  lookerIds: string[]
}

/** The rows of a flow: the person's chain of authorities, else the type's flow definition. */
function flowNodes(employeeId: string, type: FlowRequestType): FlowNode[] {
  const authorities = authoritiesOf(employeeId, type).filter(
    (item): item is Exclude<FlowAuthority, 'general-flow'> => item !== 'general-flow',
  )
  if (authorities.length === 0) return flowDefinition(type).nodes
  return authorities.map((authority, index) => ({
    id: index + 1,
    canEdit: true,
    onLooker: false,
    canDisagree: false,
    isCondition: false,
    // A "Retail Employee" chain has no stated meaning: it goes to the line manager.
    node: authority === 'retail-employee' ? 'line-manager' : authority,
    employeeId: null,
    next: index + 1 < authorities.length ? index + 2 : null,
    expression: '',
    ifTrue: null,
    ifFalse: null,
  }))
}

/** `fact op value`; a fact the request does not have, or an expression it cannot read, passes. */
export function evaluateCondition(expression: string, facts: FlowFacts): boolean {
  const match = /^\s*(\w+)\s*(>=|<=|==|!=|=|>|<)\s*(.+?)\s*$/.exec(expression)
  if (!match) return true
  const [, name = '', op, raw = ''] = match
  const fact = facts[name]
  if (fact === undefined || fact === null) return true
  const value = raw.replace(/^['"]|['"]$/g, '')
  const left = typeof fact === 'number' ? fact : String(fact)
  const right = typeof fact === 'number' ? Number(value) : value
  switch (op) {
    case '>':
      return left > right
    case '>=':
      return left >= right
    case '<':
      return left < right
    case '<=':
      return left <= right
    case '!=':
      return left !== right
    default:
      return left === right
  }
}

/** Who a flow row points at, with the label its approval is recorded under. */
function resolveNode(node: FlowNode, employee: DirectoryEmployee): [string, string] | null {
  switch (node.node) {
    case 'line-manager':
      return ['Line Manager', lineManagerOf(employee)]
    case 'hod':
      return ['HOD', departmentHeadOf(employee)]
    case 'hod-finance':
      return ['HOD Finance', headOfDepartment('Finance')]
    case 'hod-admin':
      return ['HOD Admin', headOfDepartment('Operations')]
    case 'hod-hr':
    case 'hod-hr-admin':
      return ['HOD HR', hrManagerFor(employee)]
    case 'final-authority':
      return ['HR Manager', hrManagerFor(employee)]
    case 'branch-manager': {
      const branch = employee.branchId ? branches.find(employee.branchId) : undefined
      return ['Branch Manager', branch?.managerId ?? lineManagerOf(employee)]
    }
    case 'area-manager':
      // Areas have no manager on file: the country manager stands in.
      return ['Area Manager', employee.id === TOP_MANAGER ? hrManagerFor(employee) : TOP_MANAGER]
    case 'employee':
    case 'consentee':
      return node.employeeId ? [FLOW_NODE_LABELS[node.node], node.employeeId] : null
  }
}

/**
 * Walks the flow from its first row. On-lookers are told, Can Disagree rows
 * and Consentees are asked for consent, a condition row routes by its
 * expression, and every other row is an approval step. Nobody approves their
 * own request, and the same approver twice in a row decides once (under the
 * later label), so the General Flow stays Line Manager → HR Manager.
 */
export function planFlow(
  employeeId: string,
  type: FlowRequestType = 'punch',
  facts: FlowFacts = {},
): FlowPlan {
  const employee = mustFind(employeeId)
  const nodes = flowNodes(employeeId, type)
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const plan: FlowPlan = { steps: [], consentIds: [], lookerIds: [] }
  const seen = new Set<number>()
  let current: FlowNode | undefined = nodes[0]
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    const next: number | null = current.isCondition
      ? evaluateCondition(current.expression, facts)
        ? current.ifTrue
        : current.ifFalse
      : current.next
    const resolved = current.isCondition ? null : resolveNode(current, employee)
    if (resolved && resolved[1] !== employeeId) {
      const [authority, approverId] = resolved
      if (current.onLooker) plan.lookerIds.push(approverId)
      else if (current.canDisagree || current.node === 'consentee') plan.consentIds.push(approverId)
      else {
        const last = plan.steps.at(-1)
        if (last?.approverId === approverId) plan.steps.pop()
        plan.steps.push({
          authority,
          approverId,
          status: 'waiting',
          actedById: null,
          actedAt: null,
          remarks: null,
        })
      }
    }
    current = next === null ? undefined : byId.get(next)
  }
  if (plan.steps.length === 0) {
    plan.steps.push({
      authority: 'HR Manager',
      approverId: hrManagerFor(employee),
      status: 'waiting',
      actedById: null,
      actedAt: null,
      remarks: null,
    })
  }
  const [first] = plan.steps
  if (first) first.status = 'pending'
  plan.consentIds = [...new Set(plan.consentIds)]
  plan.lookerIds = [...new Set(plan.lookerIds)]
  return plan
}

/**
 * The approval steps of a request type's flow: by default Line Manager, then
 * HR Manager (one step when they are the same person).
 */
export function buildFlow(
  employeeId: string,
  type: FlowRequestType = 'punch',
  facts: FlowFacts = {},
): StoredStep[] {
  return planFlow(employeeId, type, facts).steps
}

/** A request's plain payload fields, for flow conditions. */
function factsOf(payload: object): FlowFacts {
  const facts: FlowFacts = {}
  for (const [key, value] of Object.entries(payload) as [string, unknown][]) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      facts[key] = value
    }
  }
  return facts
}

export function currentStep(record: FlowRecord): StoredStep | null {
  if (record.status === 'cancelling') return record.cancelStep
  if (record.status !== 'pending') return null
  return record.flow.find((step) => step.status === 'pending') ?? null
}

function entry(byId: string, status: string, remarks: string | null, at: string, delegate = false) {
  return { id: createId('rh'), byId, delegate, status, remarks, at }
}

/** A fresh request, with "Requested" in its history. */
export function newRecord<T extends StoredRequest>(
  base: Omit<
    T,
    | 'status'
    | 'flow'
    | 'cancelReason'
    | 'cancelStep'
    | 'history'
    | 'applied'
    | 'createdAt'
    | 'updatedAt'
  >,
  at: string,
): T {
  const plan = planFlow(base.employeeId, base.kind, factsOf(base.payload))
  const asked = new Set(base.consents.map((consent) => consent.personId))
  const consents = [
    ...base.consents,
    ...plan.consentIds
      .filter((personId) => !asked.has(personId))
      .map((personId): StoredConsent => ({ personId, status: 'pending', remarks: null })),
  ]
  return {
    ...base,
    status: 'pending',
    flow: plan.steps,
    consents,
    cancelReason: null,
    cancelStep: null,
    history: [
      entry(base.createdById, 'Requested', null, at),
      ...plan.lookerIds.map((personId) => entry(personId, 'Informed (On Looker)', null, at)),
    ],
    applied: null,
    createdAt: at,
    updatedAt: at,
  } as T
}

/**
 * Records an approver's decision on the current step. Approving the last
 * step completes the request; rejecting any step rejects it.
 */
export function applyDecision<T extends FlowRecord>(
  record: T,
  decision: 'approve' | 'reject',
  actorId: string,
  remarks: string | null,
  at: string,
): { record: T; completed: boolean } {
  const index = record.flow.findIndex((step) => step.status === 'pending')
  const step = record.flow[index]
  if (!step) return { record, completed: false }
  const delegate = actorId !== step.approverId
  const flow = record.flow.map((item, position): StoredStep => {
    if (position === index) {
      return {
        ...item,
        status: decision === 'approve' ? 'approved' : 'rejected',
        actedById: actorId,
        actedAt: at,
        remarks,
      }
    }
    if (position === index + 1 && decision === 'approve') return { ...item, status: 'pending' }
    if (position > index && decision === 'reject') return { ...item, status: 'skipped' }
    return item
  })
  const last = index === record.flow.length - 1
  const completed = decision === 'approve' && last
  const status: RequestStatus =
    decision === 'reject' ? 'rejected' : completed ? 'completed' : 'pending'
  const label = `${decision === 'approve' ? 'Approved' : 'Rejected'} by ${step.authority}${last ? ' (Final Authority)' : ''}`
  return {
    record: {
      ...record,
      flow,
      status,
      updatedAt: at,
      history: [...record.history, entry(actorId, label, remarks, at, delegate)],
    },
    completed,
  }
}

/**
 * The person asks to cancel a completed request; the last approver of the
 * type's cancel flow ("Punch Cancel Request", by default the final
 * authority) decides.
 */
export function applyCancelRequest<T extends FlowRecord>(
  record: T,
  actorId: string,
  reason: string,
  at: string,
): T {
  const cancelType = `${record.kind as SettingsRequestType}-cancel` as const
  const final = buildFlow(record.employeeId, cancelType).at(-1) ?? record.flow.at(-1)
  return {
    ...record,
    status: 'cancelling',
    cancelReason: reason,
    cancelStep: final
      ? { ...final, status: 'pending', actedById: null, actedAt: null, remarks: null }
      : null,
    updatedAt: at,
    history: [...record.history, entry(actorId, 'Cancellation requested', reason, at)],
  }
}

export function applyCancelDecision<T extends FlowRecord>(
  record: T,
  decision: 'approve' | 'reject',
  actorId: string,
  remarks: string | null,
  at: string,
): T {
  const step = record.cancelStep
  const delegate = step !== null && actorId !== step.approverId
  return {
    ...record,
    status: decision === 'approve' ? 'cancelled' : 'completed',
    cancelStep: step
      ? {
          ...step,
          status: decision === 'approve' ? 'approved' : 'rejected',
          actedById: actorId,
          actedAt: at,
          remarks,
        }
      : null,
    updatedAt: at,
    history: [
      ...record.history,
      entry(
        actorId,
        decision === 'approve' ? 'Cancellation approved' : 'Cancellation rejected',
        remarks,
        at,
        delegate,
      ),
    ],
  }
}

export function applyConsent<T extends FlowRecord>(
  record: T,
  personId: string,
  decision: 'approve' | 'reject',
  remarks: string | null,
  at: string,
): T {
  return {
    ...record,
    consents: record.consents.map((consent) =>
      consent.personId === personId
        ? { ...consent, status: decision === 'approve' ? 'given' : 'declined', remarks }
        : consent,
    ),
    updatedAt: at,
    history: [
      ...record.history,
      entry(personId, decision === 'approve' ? 'Consent given' : 'Consent declined', remarks, at),
    ],
  }
}

export function historyEntry(byId: string, status: string, remarks: string | null, at: string) {
  return entry(byId, status, remarks, at)
}
