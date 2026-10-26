import { format, isWeekend, subDays } from 'date-fns'

import { createMockCollection } from '../collection'
import { findEmployee } from '../employees/seed'
import { PROFILES } from '../scheduling/seed'
import type {
  AttendanceBreak,
  AttendanceComment,
  DayStatus,
  HistoryEntry,
  LocalDateTime,
  PunchLog,
} from './types'

/** A punch recorded by a person or HR (machine punches are generated). */
export interface StoredPunch extends PunchLog {
  employeeId: string
  date: string
}

/**
 * HR's changes to one day (`employeeId:date`). A field left out keeps the
 * generated value; `checkIn: null` clears it.
 */
export interface DayEdit {
  id: string
  employeeId: string
  date: string
  checkIn?: LocalDateTime | null
  checkOut?: LocalDateTime | null
  markAbsent?: boolean
  markHalfDay?: boolean
  markShortDay?: boolean
  breaks?: AttendanceBreak[]
  /** Set by the "Absent" row action (Leave, Official Duty…). */
  status?: DayStatus
  relaxationReason?: string
  approvedOvertimeMinutes?: number
  /** The day's comments (one text, as the API keeps it). */
  comments?: string | null
  updatedAt: string
}

export interface StoredComment extends AttendanceComment {
  employeeId: string
  date: string
}

export interface StoredHistory extends HistoryEntry {
  employeeId: string
  date: string
}

export const dayId = (employeeId: string, date: string) => `${employeeId}:${date}`

/** The n-th Monday–Friday before today, so the samples stay recent. */
function recentWorkday(n: number): string {
  let day = new Date()
  let left = n
  while (left > 0) {
    day = subDays(day, 1)
    if (!isWeekend(day)) left -= 1
  }
  return format(day, 'yyyy-MM-dd')
}

/** Name and code of a directory person, for comment and history authors. */
export function personRef(id: string) {
  return { id, name: findEmployee(id)?.name ?? id, code: PROFILES[id]?.code ?? id }
}

const SHELLEY = personRef('em_shelley')
const LAIBA = personRef('em_laiba')

function seedEdits(): DayEdit[] {
  const date = recentWorkday(2)
  return [
    {
      id: dayId('em_shelley', date),
      employeeId: 'em_shelley',
      date,
      checkIn: `${date}T08:58`,
      comments:
        'The main gate device was offline in the morning; the check-in time was taken from the guard log.',
      updatedAt: `${date}T11:20:00.000Z`,
    },
  ]
}

function seedPunches(): StoredPunch[] {
  const date = recentWorkday(3)
  return [
    {
      id: 'pl_seed_omar_out',
      employeeId: 'em_omar',
      date,
      type: 'check-out',
      at: `${date}T17:04`,
      description: 'Forgot to punch out; confirmed by the branch manager.',
      source: 'manual',
      machineId: null,
      manuallyUpdated: true,
    },
  ]
}

function seedComments(): StoredComment[] {
  const date = recentWorkday(2)
  return [
    {
      id: 'ac_seed_1',
      employeeId: 'em_shelley',
      date,
      author: LAIBA,
      text: 'The main gate device was offline in the morning; the check-in time was taken from the guard log.',
      createdAt: `${date}T11:05:00.000Z`,
    },
  ]
}

function seedHistory(): StoredHistory[] {
  const edited = recentWorkday(2)
  const punched = recentWorkday(3)
  return [
    {
      id: 'ah_seed_1',
      employeeId: 'em_shelley',
      date: edited,
      editedBy: LAIBA,
      action: 'Updated Check In Time',
      detail: '— → 08:58 AM',
      at: `${edited}T11:20:00.000Z`,
    },
    {
      id: 'ah_seed_2',
      employeeId: 'em_omar',
      date: punched,
      editedBy: SHELLEY,
      action: 'Added Missing Punch',
      detail: 'Check Out 05:04 PM',
      at: `${punched}T18:30:00.000Z`,
    },
  ]
}

export const attendancePunches = createMockCollection<StoredPunch>({
  storageKey: 'hrms-mock-attendance-punches',
  seed: seedPunches,
})
export const attendanceEdits = createMockCollection<DayEdit>({
  storageKey: 'hrms-mock-attendance-edits',
  seed: seedEdits,
})
export const attendanceComments = createMockCollection<StoredComment>({
  storageKey: 'hrms-mock-attendance-comments',
  seed: seedComments,
})
export const attendanceHistory = createMockCollection<StoredHistory>({
  storageKey: 'hrms-mock-attendance-history',
  seed: seedHistory,
})

/** Punches HR set aside (`PATCH /attendance/logs/{id}/ignore`): listed, but not counted. */
export const attendanceIgnored = createMockCollection<{ id: string }>({
  storageKey: 'hrms-mock-attendance-ignored',
  seed: () => [],
})

export function resetAttendanceDb(): void {
  attendanceIgnored.reset()
  attendancePunches.reset()
  attendanceEdits.reset()
  attendanceComments.reset()
  attendanceHistory.reset()
}
