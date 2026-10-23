import { addDays, format, parse } from 'date-fns'
import { z } from 'zod'

import { attendanceEdits, attendanceHistory, dayId, personRef } from '../../../attendance/db'
import { createId } from '../../../utils'
import { entryOn } from '../../effects'
import { invalid, now } from '../../http'
import { ME } from '../../people'
import {
  defineStandardKind,
  seedRequest,
  type StandardKindServer,
  type StoredStandardRequest,
} from '../engine'

/*
 * Relaxation: time off inside the person's shift on one day ("Create
 * Relaxation Request": Employee Name on All, Date, Start Time, End Time,
 * Reason). The times must fall inside that day's shift on the schedule; the
 * shift is kept with the request for the Time Slot column. Approving needs a
 * reason. Approval relaxes the day in Attendance (late arrival and early
 * leave are not flagged, the day shows "Relaxation"); an approved
 * cancellation takes the relaxation off again.
 */

const ymd = /^\d{4}-\d{2}-\d{2}$/
const hm = /^([01]\d|2[0-3]):[0-5]\d$/
const schema = z.object({
  date: z.string().regex(ymd),
  startTime: z.string().regex(hm),
  endTime: z.string().regex(hm),
  reason: z.string().trim().min(1).max(500),
})
type Input = z.infer<typeof schema>

export interface RelaxationStored {
  date: string
  startTime: string
  endTime: string
  reason: string
  /** The day's shift when the request was made: its slot name and times. */
  slotName: string
  shiftIn: string
  shiftOut: string
}

/** What approval changed on the attendance day: its relaxation before. */
interface Effect {
  date: string
  hadEdit: boolean
  previousReason: string | null
}

const stored = (record: StoredStandardRequest) => record.payload as unknown as RelaxationStored
const minutesOf = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return hours * 60 + minutes
}
const asTime = (minutes: number) => {
  const value = ((minutes % 1440) + 1440) % 1440
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}
/** `17:00` → "05:00 PM". */
const clock = (time: string) => format(parse(time, 'HH:mm', new Date()), 'hh:mm a')

/**
 * The shift as minutes from its start's midnight (an overnight shift ends
 * after 1440), and a time placed on it: times before the start belong to the
 * next morning.
 */
function onShift(shiftIn: string, shiftOut: string) {
  const start = minutesOf(shiftIn)
  const end = minutesOf(shiftOut) <= start ? minutesOf(shiftOut) + 1440 : minutesOf(shiftOut)
  const place = (time: string) =>
    minutesOf(time) < start ? minutesOf(time) + 1440 : minutesOf(time)
  return { start, end, place }
}

/** "4h", "1h 30m", "45m". */
function durationText(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${String(rest)}m`
  return rest === 0 ? `${String(hours)}h` : `${String(hours)}h ${String(rest)}m`
}

function span(payload: RelaxationStored) {
  const shift = onShift(payload.shiftIn, payload.shiftOut)
  return { from: shift.place(payload.startTime), to: shift.place(payload.endTime) }
}

function toPayload(
  input: Input,
  context: {
    employeeId: string
    ignoreId: string | null
    records: readonly StoredStandardRequest[]
  },
): Response | Record<string, unknown> {
  const entry = entryOn(context.employeeId, input.date)
  if (entry?.kind !== 'shift' || !entry.clockIn || !entry.clockOut) {
    return invalid('No shift is scheduled on this day.', {
      date: 'No shift is scheduled on this day',
    })
  }
  const shiftIn: string = entry.clockIn
  const shiftOut: string = entry.clockOut
  const shift = onShift(shiftIn, shiftOut)
  const hours = `${clock(shiftIn)} - ${clock(shiftOut)}`
  const from = shift.place(input.startTime)
  const to = shift.place(input.endTime)
  if (from >= shift.end) {
    return invalid(`The relaxation must fall inside the shift (${hours}).`, {
      startTime: `Choose a time inside the shift (${hours})`,
    })
  }
  if (to <= from) {
    return invalid('End Time comes before Start Time.', {
      endTime: 'Choose a time after Start Time',
    })
  }
  if (to > shift.end) {
    return invalid(`The relaxation must fall inside the shift (${hours}).`, {
      endTime: `Choose a time inside the shift (${hours})`,
    })
  }
  const payload: RelaxationStored = {
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    reason: input.reason,
    slotName: entry.slot.name,
    shiftIn,
    shiftOut,
  }
  // Another request of the person's for the same day and overlapping times (placed on today's shift).
  const clash = context.records.find((record) => {
    if (record.id === context.ignoreId || record.employeeId !== context.employeeId) return false
    if (!['pending', 'completed', 'cancelling'].includes(record.status)) return false
    const other = stored(record)
    if (other.date !== input.date) return false
    const taken = span({ ...other, shiftIn, shiftOut })
    return taken.from < to && taken.to > from
  })
  if (clash) {
    return invalid(`${clash.code} already asks for relaxation at these times.`, {
      startTime: 'These times are already asked for',
    })
  }
  return { ...payload }
}

/** Relaxes the attendance day (the engine waives its late arrival and early leave). */
function applyRelaxation(record: StoredStandardRequest): Effect {
  const payload = stored(record)
  const id = dayId(record.employeeId, payload.date)
  const existing = attendanceEdits.find(id)
  const at = now()
  const reason = `Relaxation ${record.code}: ${payload.reason}`
  if (existing) attendanceEdits.update(id, { ...existing, relaxationReason: reason, updatedAt: at })
  else {
    attendanceEdits.insert({
      id,
      employeeId: record.employeeId,
      date: payload.date,
      relaxationReason: reason,
      updatedAt: at,
    })
  }
  attendanceHistory.insert({
    id: createId('ah'),
    employeeId: record.employeeId,
    date: payload.date,
    editedBy: personRef(ME),
    action: 'Applied Relaxation',
    detail: `${record.code}: ${clock(payload.startTime)} - ${clock(payload.endTime)}`,
    at,
  })
  return {
    date: payload.date,
    hadEdit: existing !== undefined,
    previousReason: existing?.relaxationReason ?? null,
  }
}

/** Puts the day's relaxation back as it was. */
function revertRelaxation(record: StoredStandardRequest): void {
  const effect = record.effect as Effect | undefined
  if (!effect) return
  const id = dayId(record.employeeId, effect.date)
  const current = attendanceEdits.find(id)
  if (!current) return
  const at = now()
  if (effect.previousReason !== null) {
    attendanceEdits.update(id, {
      ...current,
      relaxationReason: effect.previousReason,
      updatedAt: at,
    })
  } else {
    const { relaxationReason: _removed, ...rest } = current
    const changesLeft = Object.keys(rest).some(
      (key) => !['id', 'employeeId', 'date', 'updatedAt'].includes(key),
    )
    if (!effect.hadEdit && !changesLeft) attendanceEdits.remove(id)
    else attendanceEdits.update(id, { ...rest, updatedAt: at })
  }
  attendanceHistory.insert({
    id: createId('ah'),
    employeeId: record.employeeId,
    date: effect.date,
    editedBy: personRef(ME),
    action: 'Removed Relaxation',
    detail: `${record.code} cancelled`,
    at,
  })
}

const def: StandardKindServer<Input> = {
  kind: 'relaxation',
  settingsType: 'relaxation',
  codePrefix: 'RLX-',
  codeDigits: 4,
  schema,
  toPayload,
  dateOf: (payload) => String(payload.date),
  present: (payload) => {
    const value = payload as unknown as RelaxationStored
    const { from, to } = span(value)
    return {
      ...value,
      // "Default Time Slot (10:00 AM - 05:00 PM)" in the frames: the day's slot on the schedule.
      timeSlot: `${value.slotName} (${clock(value.shiftIn)} - ${clock(value.shiftOut)})`,
      time: `${clock(value.startTime)} - ${clock(value.endTime)}`,
      minutes: to - from,
      duration: durationText(to - from),
    }
  },
  approveNeedsRemarks: true,
  cancellationsView: true,
  onCompleted: applyRelaxation,
  onCancelled: revertRelaxation,
  seed: () => {
    const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()
    /** The first day from `offset` on which the person has a shift. */
    const shiftDay = (employeeId: string, offset: number) => {
      for (let step = 0; step < 14; step += 1) {
        const date = format(addDays(new Date(), offset + step), 'yyyy-MM-dd')
        const entry = entryOn(employeeId, date)
        if (entry?.kind === 'shift' && entry.clockIn && entry.clockOut) {
          return { date, entry, clockIn: entry.clockIn, clockOut: entry.clockOut }
        }
      }
      return null
    }
    const make = (
      number: number,
      employeeId: string,
      offset: number,
      status: StoredStandardRequest['status'],
      options: {
        /** Minutes relaxed at the start of the shift (late arrival) or its end (early leave). */
        minutes: number
        at: 'start' | 'end'
        reason: string
        daysAgo: number
        approvedSteps?: number
        cancelReason?: string
      },
    ): StoredStandardRequest[] => {
      const day = shiftDay(employeeId, offset)
      if (!day) return []
      const shift = onShift(day.clockIn, day.clockOut)
      const length = Math.min(options.minutes, shift.end - shift.start)
      const from = options.at === 'start' ? shift.start : shift.end - length
      const digits = String(number).padStart(4, '0')
      return [
        seedRequest(def, {
          id: `rlx_${digits}`,
          code: `RLX-${digits}`,
          employeeId,
          payload: {
            date: day.date,
            startTime: asTime(from),
            endTime: asTime(from + length),
            reason: options.reason,
            slotName: day.entry.slot.name,
            shiftIn: day.clockIn,
            shiftOut: day.clockOut,
          } satisfies RelaxationStored,
          at: at(options.daysAgo),
          status,
          ...(options.approvedSteps !== undefined ? { approvedSteps: options.approvedSteps } : {}),
          ...(options.cancelReason ? { cancelReason: options.cancelReason } : {}),
        }),
      ]
    }
    return [
      ...make(1, 'em_sadia', 3, 'pending', {
        minutes: 60,
        at: 'start',
        reason: 'Doctor’s appointment before work.',
        daysAgo: 1,
      }),
      ...make(2, 'em_haroon', 5, 'pending', {
        minutes: 60,
        at: 'end',
        reason: 'Picking my son up from school.',
        daysAgo: 2,
      }),
      ...make(3, 'em_zainab', 4, 'pending', {
        minutes: 30,
        at: 'start',
        reason: 'Bank visit in the morning.',
        daysAgo: 2,
        approvedSteps: 1,
      }),
      ...make(4, 'em_omer', -6, 'completed', {
        minutes: 30,
        at: 'end',
        reason: 'Family function in the evening.',
        daysAgo: 9,
      }),
      ...make(5, 'em_laiba', 8, 'cancelling', {
        minutes: 120,
        at: 'start',
        reason: 'Car service appointment.',
        daysAgo: 6,
        cancelReason: 'The appointment moved to the weekend.',
      }),
      ...make(6, 'em_shelley', 2, 'pending', {
        minutes: 240,
        at: 'end',
        reason: 'Parent-teacher meeting at school.',
        daysAgo: 1,
      }),
      ...make(7, 'em_shelley', -5, 'completed', {
        minutes: 60,
        at: 'start',
        reason: 'Electricity bill queue at the office.',
        daysAgo: 8,
      }),
      ...make(8, 'em_mahnoor', 6, 'rejected', {
        minutes: 60,
        at: 'end',
        reason: 'Personal errand.',
        daysAgo: 4,
      }),
    ]
  },
}

export const relaxationServer = defineStandardKind(def)
