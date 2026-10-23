import type { PenaltyRule, WarningPenalty } from '@/features/warning'

const year = new Date().getFullYear()
const month = new Date().getMonth() + 1
const pad = (n: number) => String(n).padStart(2, '0')

function rule(overrides: Partial<PenaltyRule> = {}): PenaltyRule {
  return {
    count: 2,
    timeSpan: 'weekly',
    startDay: 'mon',
    endDay: 'sun',
    day: 4,
    weekdays: ['wed', 'thu', 'fri'],
    from: '09:00',
    to: '09:30',
    points: 5,
    penaltyType: 'half-day',
    deduction: 'payroll',
    badgeColor: 'red',
    ...overrides,
  }
}

const monthly: Partial<PenaltyRule> = {
  timeSpan: 'monthly',
  startDay: `${year}-${pad(month)}-01`,
  endDay: `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`,
  weekdays: [],
}

const stamp = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()

/** Rows 1–5 match the Penalty table in the Figma frames; 6 adds a second page. */
export function seedWarningPenalties(): WarningPenalty[] {
  return [
    {
      id: 'pn_grace01',
      policyName: 'grace-minutes',
      title: 'Grace penalty',
      scaleType: 'number',
      rules: [rule()],
      createdAt: stamp(30),
      updatedAt: stamp(0),
    },
    {
      id: 'pn_late01',
      policyName: 'late-arrival',
      title: 'Late arrival full day',
      scaleType: 'percentage',
      rules: [rule({ penaltyType: 'full-day', points: 50, deduction: 'both', badgeColor: 'blue' })],
      createdAt: stamp(28),
      updatedAt: stamp(1),
    },
    {
      id: 'pn_late02',
      policyName: 'late-arrival',
      title: 'Late arrival penalty',
      scaleType: 'number',
      rules: [rule({ ...monthly, count: 3, penaltyType: 'full-day', points: 10 })],
      createdAt: stamp(20),
      updatedAt: stamp(0),
    },
    {
      id: 'pn_grace02',
      policyName: 'grace-minutes',
      title: 'Grace overrun',
      scaleType: 'percentage',
      rules: [rule({ ...monthly, points: 25, deduction: 'leave', badgeColor: 'green' })],
      createdAt: stamp(15),
      updatedAt: stamp(6),
    },
    {
      id: 'pn_grace03',
      policyName: 'grace-minutes',
      title: 'Repeated grace use',
      scaleType: 'number',
      rules: [rule({ count: 4 }), rule({ ...monthly, count: 8, penaltyType: 'full-day' })],
      createdAt: stamp(12),
      updatedAt: stamp(4),
    },
    {
      id: 'pn_early01',
      policyName: 'early-departure',
      title: 'Early leave penalty',
      scaleType: 'number',
      rules: [rule({ from: '17:00', to: '18:00', badgeColor: 'blue' })],
      createdAt: stamp(5),
      updatedAt: stamp(2),
    },
  ]
}
