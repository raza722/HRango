import { beforeEach, describe, expect, it } from 'vitest'

import {
  applyCancelDecision,
  applyCancelRequest,
  applyDecision,
  buildFlow,
  currentStep,
  evaluateCondition,
  newRecord,
  planFlow,
  type StoredPunchRequest,
} from './flow'
import {
  generalFlowNodes,
  requestAuthorities,
  requestFlows,
  resetRequestSettingsDb,
  type StoredFlow,
} from './settings-db'

const AT = '2026-10-20T10:00:00.000Z'

function request(employeeId: string): StoredPunchRequest {
  return newRecord<StoredPunchRequest>(
    {
      id: 'prq_test',
      code: 'RQ-ATT-9999',
      kind: 'punch',
      employeeId,
      createdById: employeeId,
      consents: [],
      payload: { date: '2026-10-19', punchType: 'check-in', punchTime: '09:05', description: '' },
    },
    AT,
  )
}

describe('request flow', () => {
  it('goes to the line manager, then the HR manager', () => {
    expect(
      buildFlow('em_omar').map((step) => [step.authority, step.approverId, step.status]),
    ).toEqual([
      ['Line Manager', 'em_ayesha', 'pending'],
      ['HR Manager', 'em_shelley', 'waiting'],
    ])
    // Reports of the HR manager need one approval; the HR manager's own go to the deputy.
    expect(buildFlow('em_laiba').map((step) => step.approverId)).toEqual(['em_shelley'])
    expect(buildFlow('em_shelley').map((step) => step.approverId)).toEqual([
      'em_daniel',
      'em_kaleem',
    ])
  })

  it('completes on the last approval and records delegates', () => {
    const first = applyDecision(request('em_haroon'), 'approve', 'em_shelley', null, AT)
    expect(first.completed).toBe(false)
    expect(first.record.status).toBe('pending')
    expect(first.record.history.at(-1)).toMatchObject({
      status: 'Approved by Line Manager',
      delegate: true,
    })
    expect(currentStep(first.record)?.approverId).toBe('em_shelley')

    const second = applyDecision(first.record, 'approve', 'em_shelley', 'Fine', AT)
    expect(second.completed).toBe(true)
    expect(second.record.status).toBe('completed')
    expect(second.record.history.at(-1)?.status).toBe('Approved by HR Manager (Final Authority)')
  })

  it('stops at a rejection and skips the steps after it', () => {
    const { record } = applyDecision(request('em_omar'), 'reject', 'em_ayesha', 'No', AT)
    expect(record.status).toBe('rejected')
    expect(record.flow.map((step) => step.status)).toEqual(['rejected', 'skipped'])
    expect(currentStep(record)).toBeNull()
  })

  it('sends a cancellation to the final authority', () => {
    const done = applyDecision(request('em_laiba'), 'approve', 'em_shelley', null, AT).record
    const cancelling = applyCancelRequest(done, 'em_laiba', 'Not needed', AT)
    expect(cancelling.status).toBe('cancelling')
    expect(currentStep(cancelling)?.approverId).toBe('em_shelley')
    expect(applyCancelDecision(cancelling, 'approve', 'em_shelley', null, AT).status).toBe(
      'cancelled',
    )
    expect(applyCancelDecision(cancelling, 'reject', 'em_shelley', 'Keep it', AT).status).toBe(
      'completed',
    )
  })
})

/** A current, active flow as Request Settings stores it. */
function flow(over: Partial<StoredFlow> & Pick<StoredFlow, 'id' | 'requestType'>): StoredFlow {
  return {
    purpose: 'request',
    name: 'Test flow',
    scopeType: 'company',
    scopeId: null,
    description: null,
    isActive: true,
    isCurrent: true,
    nodes: generalFlowNodes(over.id),
    createdAt: AT,
    updatedAt: null,
    ...over,
  }
}

const node = (stepNo: number, extra: Partial<StoredFlow['nodes'][number]>) => ({
  id: `n${String(stepNo)}`,
  stepNo,
  approverKind: null,
  employeeId: null,
  roleId: null,
  isCondition: false,
  expression: null,
  next: null,
  ifTrue: null,
  ifFalse: null,
  canEdit: false,
  canDisagree: false,
  isObserver: false,
  ...extra,
})

describe('flows from Request Settings', () => {
  beforeEach(() => {
    resetRequestSettingsDb()
  })

  it('takes the most specific active flow: employee, then the company', () => {
    requestFlows.insert(
      flow({
        id: 'fl_haroon',
        requestType: 'overtime',
        scopeType: 'employee',
        scopeId: 'em_haroon',
        nodes: [node(1, { approverKind: 'hod' }), node(2, { approverKind: 'final_authority' })],
      }),
    )
    expect(buildFlow('em_haroon', 'overtime').map((step) => step.authority)).toEqual([
      'HOD',
      'HR Manager',
    ])
    // Others keep the General Flow; a switched-off flow does not apply.
    expect(buildFlow('em_omar', 'overtime').map((step) => step.authority)).toEqual([
      'Line Manager',
      'HR Manager',
    ])
    requestFlows.update('fl_haroon', { ...requestFlows.find('fl_haroon')!, isActive: false })
    expect(buildFlow('em_haroon', 'overtime')[0]?.authority).toBe('Line Manager')
  })

  it('routes by conditions, tells on-lookers and asks for consent', () => {
    requestFlows.insert(
      flow({
        id: 'fl_ot',
        requestType: 'overtime',
        nodes: [
          node(1, { isCondition: true, expression: 'days > 3', ifTrue: 3, ifFalse: 2 }),
          node(2, { approverKind: 'line_manager', next: 4 }),
          node(3, { approverKind: 'hod' }),
          node(4, { approverKind: 'employee', employeeId: 'em_kaleem', isObserver: true }),
          node(5, { approverKind: 'employee', employeeId: 'em_hina', canDisagree: true }),
          node(6, { approverKind: 'final_authority' }),
        ],
      }),
    )
    const long = planFlow('em_haroon', 'overtime', { days: 5 })
    expect(long.steps.map((step) => step.authority)).toEqual(['HOD', 'HR Manager'])
    const short = planFlow('em_haroon', 'overtime', { days: 1 })
    expect(short.steps.map((step) => step.authority)).toEqual(['Line Manager', 'HR Manager'])
    expect(short.lookerIds).toEqual(['em_kaleem'])
    expect(short.consentIds).toEqual(['em_hina'])
  })

  it('finds authority holders and lets a cancellation walk the request flow', () => {
    requestFlows.insert(
      flow({
        id: 'fl_exp',
        requestType: 'expense',
        nodes: [
          node(1, { approverKind: 'finance_manager' }),
          node(2, { approverKind: 'it_administrator' }),
        ],
      }),
    )
    // Hina holds Finance Manager everywhere; Omar holds IT Administrator for Islamabad only.
    expect(buildFlow('em_haroon', 'expense').map((step) => step.approverId)).toEqual(['em_hina'])
    requestAuthorities.insert({
      id: 'au_t',
      authority: 'it_administrator',
      employeeId: 'em_kaleem',
      requestType: 'expense',
      branchId: null,
      departmentId: null,
      description: null,
      isActive: true,
      createdAt: AT,
      updatedAt: null,
    })
    expect(buildFlow('em_haroon', 'expense-cancel').map((step) => step.approverId)).toEqual([
      'em_hina',
      'em_kaleem',
    ])
  })

  it('reads conditions as the API does: a missing fact is false', () => {
    expect(evaluateCondition('days > 3', { days: 5 })).toBe(true)
    expect(evaluateCondition('amount >= 100000', { amount: 5000 })).toBe(false)
    expect(evaluateCondition('amount > 100', {})).toBe(false)
  })
})
