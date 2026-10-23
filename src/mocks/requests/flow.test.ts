import { describe, expect, it } from 'vitest'

import {
  applyCancelDecision,
  applyCancelRequest,
  applyDecision,
  buildFlow,
  currentStep,
  newRecord,
  type StoredPunchRequest,
} from './flow'

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
