import { addDays, format, startOfMonth } from 'date-fns'

import type {
  BenefitPlan,
  BenefitProfile,
  Election,
  ElectionStatus,
  EnrollmentWindow,
  PlanYear,
} from '@/features/benefits'

import { DIRECTORY } from '../employees/seed'

// Sample data around the drawn rows: the "Fiscal year" plan year (this year, 5 plans, Active)
// with HDHP1, HDHP2 and FSA-Eligible HMO as its medical plans, last year's plan year, two
// enrollment windows and the people's elections. Dates follow today, so the statuses stay right.

const year = () => new Date().getFullYear()
const on = (offset: number, month: number, dayOfMonth: number) =>
  format(new Date(year() + offset, month - 1, dayOfMonth), 'yyyy-MM-dd')
const created = (offset: number) => new Date(year() + offset, 0, 1, 9).toISOString()

const plan = (
  id: string,
  category: BenefitPlan['category'],
  name: string,
  planType: string,
  planTypeId: string,
  carrier: string,
  endDate: string,
): BenefitPlan => ({
  id,
  category,
  name,
  planType,
  planTypeId,
  carrier,
  startDate: on(0, 1, 1),
  endDate,
  attachmentName: `${name} summary of benefits.pdf`,
  attachmentSize: 248_000 + name.length * 1_024,
  eligibility: 'Full-Time',
  createdAt: created(-1),
})

export function seedPlans(): BenefitPlan[] {
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

export function seedPlanYears(): PlanYear[] {
  return [
    {
      id: 'by_fiscal',
      name: 'Fiscal year',
      startDate: on(0, 1, 1),
      endDate: on(1, 1, 1),
      planIds: ['bp_hdhp1', 'bp_hdhp2', 'bp_fsa_hmo', 'bp_dental_ppo', 'bp_basic_life'],
      newHireStart: 'immediately',
      electionPeriod: 1,
      electionUnit: 'month',
      createdAt: created(-1),
    },
    {
      id: 'by_previous',
      name: `Fiscal year ${String(year() - 1)}`,
      startDate: on(-1, 1, 1),
      endDate: on(0, 1, 1),
      planIds: ['bp_hdhp1', 'bp_dental_ppo', 'bp_basic_life'],
      newHireStart: 'waiting-period',
      electionPeriod: 30,
      electionUnit: 'day',
      createdAt: created(-2),
    },
  ]
}

export function seedEnrollmentWindows(): EnrollmentWindow[] {
  const today = new Date()
  return [
    {
      id: 'ew_fiscal',
      name: 'Fiscal year open enrollment',
      planYearId: 'by_fiscal',
      effectiveDate: on(0, 1, 1),
      enrollmentEndDate: on(-1, 12, 15),
      planIds: ['bp_hdhp1', 'bp_hdhp2', 'bp_fsa_hmo', 'bp_dental_ppo', 'bp_basic_life'],
      employeeIds: DIRECTORY.map((person) => person.id),
      createdAt: created(-1),
    },
    {
      id: 'ew_new_hires',
      name: 'New hire enrollment',
      planYearId: 'by_fiscal',
      effectiveDate: format(startOfMonth(addDays(startOfMonth(today), 32)), 'yyyy-MM-dd'),
      enrollmentEndDate: format(addDays(today, 20), 'yyyy-MM-dd'),
      planIds: ['bp_hdhp1', 'bp_dental_ppo'],
      employeeIds: ['em_laiba', 'em_kashif'],
      createdAt: new Date(today.getTime() - 3 * 86_400_000).toISOString(),
    },
  ]
}

/** This year: 22 approved, 3 pending, 2 incomplete, 1 waived; last year: 18 approved. */
export function seedElections(): Election[] {
  const people = DIRECTORY.map((person) => person.id)
  const current: Election[] = people.flatMap((employeeId, index): Election[] => {
    let status: ElectionStatus | null = null
    if (index < 22) status = 'approved'
    else if (index < 25) status = 'pending'
    else if (index < 27) status = 'incomplete'
    else if (index < 28) status = 'waived'
    if (!status) return []
    const planIds =
      status === 'waived'
        ? []
        : index % 3 === 2
          ? ['bp_hdhp2', 'bp_dental_ppo', 'bp_basic_life']
          : ['bp_hdhp1', 'bp_dental_ppo', 'bp_basic_life']
    return [{ id: `be_${employeeId}`, employeeId, planYearId: 'by_fiscal', planIds, status }]
  })
  const previous: Election[] = people.slice(0, 18).map((employeeId) => ({
    id: `be_prev_${employeeId}`,
    employeeId,
    planYearId: 'by_previous',
    planIds: ['bp_hdhp1', 'bp_dental_ppo'],
    status: 'approved',
  }))
  return [...current, ...previous]
}

const STREETS = ['Main Boulevard', 'Canal Road', 'Jail Road', 'Mall Road', 'Club Road']
const CITIES = ['Lahore', 'Islamabad', 'Karachi', 'Rawalpindi', 'Dubai']

/** Every person's benefit details; twelve of them miss one or two. */
export function seedProfiles(): BenefitProfile[] {
  const missing: Record<number, (keyof Omit<BenefitProfile, 'id'>)[]> = {
    4: ['dateOfBirth'],
    7: ['homeAddress'],
    9: ['maritalStatus', 'homeAddress'],
    12: ['dateOfBirth'],
    15: ['homeAddress'],
    18: ['maritalStatus'],
    21: ['dateOfBirth', 'homeAddress'],
    24: ['homeAddress'],
    27: ['dateOfBirth'],
    29: ['maritalStatus'],
    31: ['homeAddress'],
    33: ['dateOfBirth', 'maritalStatus', 'homeAddress'],
  }
  return DIRECTORY.map((person, index) => {
    const profile: BenefitProfile = {
      id: person.id,
      dateOfBirth: format(
        new Date(1975 + (index % 25), index % 12, 1 + (index % 27)),
        'yyyy-MM-dd',
      ),
      maritalStatus: index % 3 === 0 ? 'Single' : 'Married',
      homeAddress: `House ${String(10 + index)}, ${STREETS[index % STREETS.length] ?? ''}, ${CITIES[index % CITIES.length] ?? ''}`,
    }
    for (const key of missing[index] ?? []) profile[key] = null
    return profile
  })
}
