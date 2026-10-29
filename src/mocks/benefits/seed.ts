import { addDays, format } from 'date-fns'

import type { ElectionRec, FileRec, PlanRec, PlanYearRec, UpdateRequestRec, WindowRec } from './db'

// Sample data around the drawn rows: the "Fiscal year" plan year (this year, 5 plans, Active)
// with HDHP1, HDHP2 and FSA-Eligible HMO as its medical plans, last year's plan year, two
// enrollment windows and the elections of people in the shared company directory
// (`../employees/seed.ts`). Dates follow today, so the statuses stay right.

const BY = 'Shelley Kannes'
const year = () => new Date().getFullYear()
const on = (offset: number, month: number, dayOfMonth: number) =>
  format(new Date(year() + offset, month - 1, dayOfMonth), 'yyyy-MM-dd')
const created = (offset: number) => `${String(year() + offset)}-01-01T09:00:00`
const stamp = (offset: number) => ({
  createdAt: created(offset),
  createdByName: BY,
  updatedAt: null,
  rowVersion: '0000000000000001',
})

const plan = (
  id: string,
  category: PlanRec['category'],
  name: string,
  planType: string,
  planTypeRef: string,
  carrier: string,
  endDate: string,
): PlanRec => ({
  id,
  category,
  name,
  planType,
  planTypeRef,
  carrier,
  startDate: on(0, 1, 1),
  endDate,
  description: null,
  status: 'active',
  ...stamp(-1),
})

export function seedPlans(): PlanRec[] {
  return [
    plan('bp_hdhp1', 'medical', 'HDHP1', 'HDHP', '12312', 'Aetna', on(1, 3, 21)),
    plan('bp_hdhp2', 'medical', 'HDHP2', 'HDHP', '12313', 'Aetna', on(1, 3, 21)),
    plan(
      'bp_fsa_hmo',
      'medical',
      'FSA-Eligible HMO',
      'HMO',
      '12314',
      'Kaiser Permanente',
      on(1, 3, 21),
    ),
    plan('bp_dental_ppo', 'dental', 'Dental PPO', 'DPPO', '22410', 'Delta Dental', on(1, 5, 30)),
    plan(
      'bp_vision',
      'vision',
      'Vision Plus',
      'Vision PPO',
      '33120',
      'VSP Vision Care',
      on(1, 5, 30),
    ),
    plan('bp_basic_life', 'life', 'Basic Life', 'Basic Life', '44100', 'MetLife', on(1, 12, 31)),
    plan(
      'bp_supp_life',
      'life',
      'Supplemental Life',
      'Supplemental Life',
      '44101',
      'MetLife',
      on(1, 12, 31),
    ),
  ]
}

export function seedPlanYears(): PlanYearRec[] {
  return [
    {
      id: 'by_fiscal',
      name: 'Fiscal year',
      startDate: on(0, 1, 1),
      endDate: on(0, 12, 31),
      newHireStart: 'immediately',
      waitingPeriodDays: null,
      electionPeriod: 1,
      electionUnit: 'month',
      planIds: ['bp_hdhp1', 'bp_hdhp2', 'bp_fsa_hmo', 'bp_dental_ppo', 'bp_basic_life'],
      ...stamp(-1),
    },
    {
      id: 'by_previous',
      name: `Fiscal year ${String(year() - 1)}`,
      startDate: on(-1, 1, 1),
      endDate: on(-1, 12, 31),
      newHireStart: 'waiting_period',
      waitingPeriodDays: 30,
      electionPeriod: 30,
      electionUnit: 'day',
      planIds: ['bp_hdhp1', 'bp_dental_ppo', 'bp_basic_life'],
      ...stamp(-2),
    },
  ]
}

export function seedWindows(): WindowRec[] {
  const today = new Date()
  return [
    {
      id: 'ew_fiscal',
      name: 'Fiscal year open enrollment',
      kind: 'open_enrollment',
      planYearId: 'by_fiscal',
      effectiveDate: on(0, 1, 1),
      closesOn: on(0, 1, 15),
      description: null,
      planIds: ['bp_hdhp1', 'bp_hdhp2', 'bp_fsa_hmo', 'bp_dental_ppo', 'bp_basic_life'],
      employeeIds: [],
      ...stamp(-1),
    },
    {
      id: 'ew_new_hires',
      name: 'New hire enrollment',
      kind: 'new_hire',
      planYearId: 'by_fiscal',
      effectiveDate:
        format(today, 'yyyy-MM-dd') <= on(0, 12, 31) ? format(today, 'yyyy-MM-dd') : on(0, 12, 31),
      closesOn: format(addDays(today, 20), 'yyyy-MM-dd'),
      description: null,
      planIds: ['bp_hdhp1', 'bp_dental_ppo'],
      employeeIds: ['em_maryam', 'em_saad'],
      ...stamp(0),
    },
  ]
}

export function seedElections(): ElectionRec[] {
  const election = (
    id: string,
    employeeId: string,
    planYearId: string,
    status: ElectionRec['status'],
    planIds: string[],
  ): ElectionRec => ({
    id,
    employeeId,
    planYearId,
    enrollmentWindowId: planYearId === 'by_fiscal' ? 'ew_fiscal' : null,
    status,
    planIds,
    submittedAt: status === 'incomplete' ? null : created(0),
    decidedByName: status === 'approved' ? BY : null,
    decidedAt: status === 'approved' ? created(0) : null,
    remarks: null,
    ...stamp(0),
  })
  return [
    election('be_hina', 'em_hina', 'by_fiscal', 'approved', [
      'bp_hdhp1',
      'bp_dental_ppo',
      'bp_basic_life',
    ]),
    election('be_hamza', 'em_hamza', 'by_fiscal', 'approved', ['bp_hdhp1', 'bp_basic_life']),
    election('be_omer', 'em_omer', 'by_fiscal', 'pending', ['bp_hdhp2', 'bp_dental_ppo']),
    election('be_maryam', 'em_maryam', 'by_fiscal', 'incomplete', []),
    election('be_ayesha', 'em_ayesha', 'by_fiscal', 'waived', []),
    election('be_prev_hina', 'em_hina', 'by_previous', 'waived', []),
  ]
}

export function seedFiles(): FileRec[] {
  const file = (planId: string, name: string, sizeBytes: number): FileRec => ({
    id: `at_${planId}`,
    fileId: `file_${planId}`,
    fileName: name,
    mimeType: 'application/pdf',
    sizeBytes,
    planId,
    createdAt: created(-1),
    rowVersion: '0000000000000001',
  })
  return [
    file('bp_hdhp1', 'HDHP1 summary of benefits.pdf', 253_120),
    file('bp_dental_ppo', 'Dental PPO summary of benefits.pdf', 259_264),
    file('bp_basic_life', 'Basic Life certificate.pdf', 189_440),
  ]
}

export function seedUpdateRequests(): UpdateRequestRec[] {
  return []
}
