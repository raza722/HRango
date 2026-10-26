import { apiClient } from '@/lib/axios'
import { useAuthStore } from '@/stores/auth-store'

/*
 * Relaxation and Official Visit share the API's `time_window` kind: one date
 * with a time range (`req.req_time_window`). The details come back with the
 * day's time slot the request was checked against.
 */

/** `details` of a Relaxation or Official Visit request, as the API sends them. */
export interface TimeWindowDetails {
  /** The request type code (`relaxation`, `official_visit`). */
  windowKind: string | null
  windowDate: string
  /** `HH:mm:ss`. */
  startTime: string
  endTime: string
  durationMinutes: number | null
  /** The day's time slot (the shift), when the person had one. */
  timeSlotId: string | null
  timeSlotName: string | null
  slotStartTime: string | null
  slotEndTime: string | null
}

/** `details` sent with POST / PUT. */
export interface TimeWindowInput {
  windowDate: string
  /** `HH:mm`. */
  startTime: string
  endTime: string
}

/** `09:05:00` → `09:05`. */
export const hm = (time: string | null | undefined) => (time ? time.slice(0, 5) : '')

/** "4h", "1h 30m", "45m". */
export function durationText(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${String(rest)}m`
  return rest === 0 ? `${String(hours)}h` : `${String(hours)}h ${String(rest)}m`
}

/** The person's shift on a day, from the schedule. */
export interface DaySlot {
  slotName: string
  /** `HH:mm`. */
  start: string
  end: string
  /** Shifts that day: the API checks the times against the shift only when there is one. */
  count: number
}

interface BoardShift {
  workDate: string
  startAt: string
  endAt: string
  timeSlotName: string | null
}

interface BoardPage {
  data: { employee: { id: string; name?: string }; shifts: BoardShift[] }[]
}

/**
 * `GET /scheduling/schedules?employeeId&from&to` for one day. Without an
 * employee the caller's own row (their permission's own scope). Null when no
 * shift is scheduled.
 */
export async function fetchDaySlot(
  employeeId: string | undefined,
  date: string,
  signal?: AbortSignal,
): Promise<DaySlot | null> {
  const { data } = await apiClient.get<BoardPage>('/scheduling/schedules', {
    params: { ...(employeeId ? { employeeId } : {}), from: date, to: date, pageSize: 10 },
    signal,
  })
  // Without an employee: a single row is the caller's own (own scope); with a wider scope, the
  // row under the signed-in person's name (a user the API links to no employee).
  const name = useAuthStore.getState().user?.name
  const row = employeeId
    ? data.data.find((item) => item.employee.id === employeeId)
    : data.data.length === 1
      ? data.data[0]
      : data.data.find((item) => item.employee.name === name)
  const shifts = (row?.shifts ?? []).filter((shift) => shift.workDate === date)
  const first = shifts[0]
  if (!first) return null
  return {
    slotName: first.timeSlotName ?? 'Shift',
    start: first.startAt.slice(11, 16),
    end: first.endAt.slice(11, 16),
    count: shifts.length,
  }
}

export const daySlotKey = (employeeId: string | undefined, date: string) =>
  ['requests', 'day-slot', employeeId ?? 'me', date] as const
