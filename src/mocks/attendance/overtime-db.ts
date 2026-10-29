import { format, isWeekend, subDays } from 'date-fns'

import type {
  EncashmentType,
  OvertimePolicy,
  OvertimePolicyPeriod,
  OvertimeSettings,
} from '@/features/attendance'

import { createMockCollection } from '../collection'
import { leaveTypeStore } from '../leaves/db'
import { attendanceEdits, type DayEdit, dayId } from './db'

/*
 * Attendance → Overtime settings tables: the overtime policies with their slabs
 * (`/attendance/settings/overtime-policies`) and the overtime settings
 * (`/attendance/settings/overtime`). The overtime requests themselves live with the other
 * request types (`src/mocks/requests/standard/kinds/overtime.ts`).
 */

export interface OvertimePolicyRecord {
  id: string
  name: string
  period: OvertimePolicyPeriod
  description: string | null
  isActive: boolean
  slabs: {
    id: string
    minMinutes: number
    maxMinutes: number
    encashmentType: EncashmentType
    leaveTypeId: string | null
  }[]
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface OvertimeSettingsRecord extends OvertimeSettings {
  id: 'settings'
}

let versionCounter = 0
/** A new opaque rowVersion, as the API hands back after every write. */
export function nextOvertimeVersion(): string {
  versionCounter += 1
  return `0x${Date.now().toString(16).padStart(12, '0')}${versionCounter.toString(16).padStart(4, '0')}`
}

/** The n-th Monday–Friday before today, so the samples stay recent. */
export function recentWorkday(n: number): string {
  let day = new Date()
  let left = n
  while (left > 0) {
    day = subDays(day, 1)
    if (!isWeekend(day)) left -= 1
  }
  return format(day, 'yyyy-MM-dd')
}

function seedPolicies(): OvertimePolicyRecord[] {
  return [
    {
      id: 'otp_daily',
      name: 'Overtime',
      period: 'daily',
      description: 'What a day of approved overtime encashes as.',
      isActive: true,
      slabs: [
        {
          id: 'ots_d1',
          minMinutes: 60,
          maxMinutes: 119,
          encashmentType: 'leave',
          leaveTypeId: 'lt_casual',
        },
        {
          id: 'ots_d2',
          minMinutes: 120,
          maxMinutes: 179,
          encashmentType: 'leave',
          leaveTypeId: 'lt_sick',
        },
        {
          id: 'ots_d3',
          minMinutes: 180,
          maxMinutes: 240,
          encashmentType: 'full_day',
          leaveTypeId: null,
        },
      ],
      createdAt: '2024-08-26T09:00:00.000Z',
      updatedAt: null,
      rowVersion: '0x0000000000010001',
    },
    {
      id: 'otp_monthly',
      name: 'New Overtime',
      period: 'monthly',
      description: 'What a month of approved overtime adds up to.',
      isActive: true,
      slabs: [
        {
          id: 'ots_m1',
          minMinutes: 600,
          maxMinutes: 1199,
          encashmentType: 'leave',
          leaveTypeId: 'lt_casual',
        },
        {
          id: 'ots_m2',
          minMinutes: 1200,
          maxMinutes: 2400,
          encashmentType: 'full_day',
          leaveTypeId: null,
        },
      ],
      createdAt: '2024-08-26T09:30:00.000Z',
      updatedAt: null,
      rowVersion: '0x0000000000010002',
    },
  ]
}

const DEFAULT_SETTINGS: OvertimeSettingsRecord = {
  id: 'settings',
  overtimeOnCheckIn: false,
  overtimeOnCheckOut: true,
  overtimeApprovalRequired: true,
  doNotAutoCreateRequests: false,
  overtimeOnHolidays: true,
  overtimeAfterDutyDuration: true,
  encashmentShiftMinutes: 480,
  rowVersion: '0x0000000000020001',
}

export const overtimePolicies = createMockCollection<OvertimePolicyRecord>({
  storageKey: 'hrms-mock-overtime-policies-api',
  seed: seedPolicies,
})

export const overtimeSettingsStore = createMockCollection<OvertimeSettingsRecord>({
  storageKey: 'hrms-mock-overtime-settings',
  seed: () => [{ ...DEFAULT_SETTINGS }],
})

export function currentOvertimeSettings(): OvertimeSettingsRecord {
  return overtimeSettingsStore.find('settings') ?? DEFAULT_SETTINGS
}

/** Restores the Overtime settings tables to their seed data (the requests reset with Requests). */
export function resetAttendanceOvertimeDb(): void {
  overtimePolicies.reset()
  overtimeSettingsStore.reset()
}

/** A stored policy as the API answers it (`OvertimePolicyOut`, with the leave types' names). */
export function toPolicyOut(record: OvertimePolicyRecord): OvertimePolicy {
  return {
    ...record,
    slabCount: record.slabs.length,
    slabs: record.slabs.map((slab) => ({
      ...slab,
      leaveTypeName: slab.leaveTypeId
        ? (leaveTypeStore.find(slab.leaveTypeId)?.title ?? null)
        : null,
    })),
  }
}

/** The active policy of a period in force (the newest active one). */
export function activeOvertimePolicy(period: OvertimePolicyPeriod): OvertimePolicy | undefined {
  return overtimePolicies
    .all()
    .filter((policy) => policy.period === period && policy.isActive)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toPolicyOut)[0]
}

/**
 * Writes the approved minutes onto the person's day, so the time sheet's Approved Overtime
 * column (`DayEdit.approvedOvertimeMinutes`) shows what Overtime granted. Returns what was
 * there before, to put back when the approval is cancelled.
 */
export function recordApprovedOvertime(
  employeeId: string,
  date: string,
  minutes: number | undefined,
): { previous: number | undefined } {
  const id = dayId(employeeId, date)
  const existing = attendanceEdits.find(id)
  const { approvedOvertimeMinutes: previous, ...rest }: Omit<DayEdit, 'updatedAt'> = existing ?? {
    id,
    employeeId,
    date,
  }
  const next: DayEdit = {
    ...rest,
    ...(minutes === undefined ? {} : { approvedOvertimeMinutes: minutes }),
    updatedAt: new Date().toISOString(),
  }
  if (existing) attendanceEdits.update(id, next)
  else attendanceEdits.insert(next)
  return { previous }
}
