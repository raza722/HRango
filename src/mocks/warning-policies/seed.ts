import type { PolicyPeriod, WarningPolicy } from '@/features/warning'

const year = new Date().getFullYear()
const iso = (month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

function yearly(overrides: Partial<PolicyPeriod> = {}): PolicyPeriod {
  return {
    startDay: iso(1, 1),
    endDay: iso(12, 31),
    month: 3,
    day: 4,
    weekdays: [],
    totalGraceMinutes: 600,
    clockIn: '09:00',
    clockOut: '18:00',
    minutes: 15,
    ...overrides,
  }
}

function monthly(month: number, overrides: Partial<PolicyPeriod> = {}): PolicyPeriod {
  const lastDay = new Date(year, month, 0).getDate()
  return {
    startDay: iso(month, 1),
    endDay: iso(month, lastDay),
    month: month - 1,
    day: 1,
    weekdays: [],
    totalGraceMinutes: 60,
    clockIn: '09:00',
    clockOut: '18:00',
    minutes: 10,
    ...overrides,
  }
}

function weekly(overrides: Partial<PolicyPeriod> = {}): PolicyPeriod {
  return {
    startDay: 'mon',
    endDay: 'sun',
    month: null,
    day: 1,
    weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    totalGraceMinutes: 30,
    clockIn: '09:00',
    clockOut: '18:00',
    minutes: 10,
    ...overrides,
  }
}

const stamp = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()

/**
 * Rows 1–5 match the Warning Policy table in the Figma frames; 6–7 add a
 * second page so pagination has something to do.
 */
export function seedWarningPolicies(): WarningPolicy[] {
  return [
    {
      id: 'wp_grace01',
      policyName: 'grace-minutes',
      title: 'Grace',
      timeSpan: 'monthly',
      clockEvent: 'clock-in',
      periods: [monthly(4, { day: 4 })],
      createdAt: stamp(40),
      updatedAt: stamp(12),
    },
    {
      id: 'wp_late01',
      policyName: 'late-arrival',
      title: 'Late',
      timeSpan: 'weekly',
      clockEvent: 'clock-in',
      periods: [weekly({ weekdays: ['wed', 'thu', 'fri'], day: 4 })],
      createdAt: stamp(38),
      updatedAt: stamp(10),
    },
    {
      id: 'wp_late02',
      policyName: 'late-arrival',
      title: 'Late',
      timeSpan: 'yearly',
      clockEvent: 'clock-in',
      periods: [yearly()],
      createdAt: stamp(35),
      updatedAt: stamp(9),
    },
    {
      id: 'wp_month01',
      policyName: 'grace-minutes',
      title: 'Month',
      timeSpan: 'monthly',
      clockEvent: 'clock-in',
      periods: [monthly(5), monthly(6)],
      createdAt: stamp(30),
      updatedAt: stamp(7),
    },
    {
      id: 'wp_month02',
      policyName: 'grace-minutes',
      title: 'Month End',
      timeSpan: 'monthly',
      clockEvent: 'clock-out',
      periods: [monthly(7, { clockIn: '10:00', clockOut: '19:00' })],
      createdAt: stamp(28),
      updatedAt: stamp(6),
    },
    {
      id: 'wp_early01',
      policyName: 'early-departure',
      title: 'Early Leave',
      timeSpan: 'weekly',
      clockEvent: 'clock-out',
      periods: [weekly({ totalGraceMinutes: 45, minutes: 15 })],
      createdAt: stamp(20),
      updatedAt: stamp(3),
    },
    {
      id: 'wp_ot01',
      policyName: 'overtime',
      title: 'Overtime Cap',
      timeSpan: 'yearly',
      clockEvent: 'clock-out',
      periods: [
        yearly({ clockIn: '18:00', clockOut: '22:00', totalGraceMinutes: 1200, minutes: 30 }),
      ],
      createdAt: stamp(14),
      updatedAt: stamp(1),
    },
  ]
}
