import { useQuery } from '@tanstack/react-query'
import { addDays, differenceInCalendarDays, format, parse } from 'date-fns'

import { apiClient } from '@/lib/axios'

import { standardKeys } from '../../standard.api'
import type { StandardKind } from '../../standard.types'
import type { ShiftDay } from './work-from-home.types'

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())
const iso = (date: Date) => format(date, 'yyyy-MM-dd')

/** The longest stretch one strip asks for. */
export const MAX_STRIP_DAYS = 62

/** One row of Scheduling's board (`GET /scheduling/schedules`), the parts the strip reads. */
interface BoardRow {
  employee: { id: string; code: string; name: string; departmentName: string | null }
  shifts: {
    workDate: string
    startAt: string
    endAt: string
    timeSlotName: string
    isWfh: boolean
  }[]
  restDays: { restDate: string; isPayable: boolean }[]
  holidays: { holidayDate: string; holidayName: string }[]
}

/** The person and their days, as the strip draws them. */
export interface ScheduleStrip {
  person: {
    id: string
    name: string
    code: string
    departmentName: string | null
    photoUrl: null
  } | null
  days: ShiftDay[]
}

const clock = (time: string) => format(parse(time, 'HH:mm', new Date()), 'hh:mm a')

/** The board's row → one entry per day: the shift, a rest day, a holiday or a day off. */
export function toStrip(row: BoardRow | undefined, from: string, to: string): ScheduleStrip {
  const days: ShiftDay[] = []
  const span = differenceInCalendarDays(day(to), day(from))
  for (let index = 0; index <= span; index += 1) {
    const date = iso(addDays(day(from), index))
    const shift = row?.shifts.find((item) => item.workDate === date)
    if (shift) {
      const clockIn = shift.startAt.slice(11, 16)
      const clockOut = shift.endAt.slice(11, 16)
      days.push({
        date,
        status: 'shift',
        clockIn,
        clockOut,
        label: `${clock(clockIn)} - ${clock(clockOut)}`,
        slotName: shift.timeSlotName,
        workFromHome: shift.isWfh,
      })
      continue
    }
    const rest = row?.restDays.find((item) => item.restDate === date)
    const holiday = row?.holidays.find((item) => item.holidayDate === date)
    days.push({
      date,
      status: rest ? 'rest' : 'off',
      clockIn: null,
      clockOut: null,
      label: rest ? 'Rest Day' : (holiday?.holidayName ?? 'Day off'),
      slotName: null,
      workFromHome: false,
    })
  }
  return {
    person: row
      ? {
          id: row.employee.id,
          name: row.employee.name,
          code: row.employee.code,
          departmentName: row.employee.departmentName,
          photoUrl: null,
        }
      : null,
    days,
  }
}

/**
 * A person's days between two dates from Scheduling's board
 * (`GET /scheduling/schedules?employeeId&from&to`; with no employee, the
 * signed-in person's own: `tab=my`). Kept under the type's query key, so
 * approvals refresh it.
 */
export function useScheduleDays(
  kind: StandardKind,
  employeeId: string | null | undefined,
  from: string,
  to: string,
  { mine = false }: { mine?: boolean } = {},
) {
  const span = from && to ? differenceInCalendarDays(day(to), day(from)) : -1
  return useQuery({
    queryKey: [...standardKeys.kind(kind), 'schedule', employeeId ?? (mine ? 'me' : ''), from, to],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<{ data: BoardRow[] }>('/scheduling/schedules', {
        params: employeeId
          ? { tab: 'all', employeeId, from, to, pageSize: 1 }
          : { tab: 'my', from, to, pageSize: 1 },
        signal,
      })
      const row = employeeId
        ? data.data.find((item) => item.employee.id === employeeId)
        : data.data[0]
      return toStrip(row, from, to)
    },
    enabled: (Boolean(employeeId) || mine) && span >= 0 && span < MAX_STRIP_DAYS,
  })
}
