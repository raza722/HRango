import { z } from 'zod'

import type {
  DayDetail,
  DayEditInput,
  DayMark,
  LocalDateTime,
  TimeSheetDay,
} from '../types/attendance.types'
import { splitLocal, toLocal } from '../utils/local-time'

const dateText = z.string()
const timeText = z.string()

export const breakRowSchema = z.object({
  type: z.string(),
  outDate: dateText,
  outTime: timeText,
  inDate: dateText,
  inTime: timeText,
})

/** Combines a date and a time input; null when both are empty. */
function joined(date: string, time: string): LocalDateTime | null {
  return date && time ? toLocal(date, time) : null
}

/**
 * Time Sheet Edit: check in / out (date + time), Mark Absent / Half Day /
 * Short Day, the breaks and the comments. A date without a time (or the
 * reverse) is incomplete; check out must follow check in; each break must end
 * after it starts. The break type is optional (the API allows a break without one).
 */
export const dayEditSchema = z
  .object({
    checkInDate: dateText,
    checkInTime: timeText,
    checkOutDate: dateText,
    checkOutTime: timeText,
    markAbsent: z.boolean(),
    markHalfDay: z.boolean(),
    markShortDay: z.boolean(),
    breaks: z.array(breakRowSchema).max(50),
    comments: z.string().max(4000, 'Keep it under 4000 characters'),
  })
  .superRefine((values, ctx) => {
    const issue = (path: string, message: string) => {
      ctx.addIssue({ code: 'custom', path: path.split('.'), message })
    }
    // An absent day saves no times or breaks, so there is nothing to check.
    if (values.markAbsent) return
    if (values.checkInDate && !values.checkInTime) issue('checkInTime', 'Enter the check in time')
    if (values.checkInTime && !values.checkInDate) issue('checkInDate', 'Choose the check in date')
    if (values.checkOutDate && !values.checkOutTime) {
      issue('checkOutTime', 'Enter the check out time')
    }
    if (values.checkOutTime && !values.checkOutDate) {
      issue('checkOutDate', 'Choose the check out date')
    }
    const checkIn = joined(values.checkInDate, values.checkInTime)
    const checkOut = joined(values.checkOutDate, values.checkOutTime)
    if (checkOut && !checkIn && !values.checkInTime) {
      issue('checkInTime', 'Enter the check in time first')
    }
    if (checkIn && checkOut && checkOut <= checkIn) {
      issue('checkOutTime', 'Check out must be after check in')
    }
    if (values.markHalfDay && values.markShortDay) {
      issue('markShortDay', 'Choose Half Day or Short Day, not both')
    }
    values.breaks.forEach((row, index) => {
      const at = (field: string) => `breaks.${index}.${field}`
      if (!row.outDate) issue(at('outDate'), 'Choose a date')
      if (!row.outTime) issue(at('outTime'), 'Enter a time')
      if (row.inDate && !row.inTime) issue(at('inTime'), 'Enter a time')
      if (row.inTime && !row.inDate) issue(at('inDate'), 'Choose a date')
      const out = joined(row.outDate, row.outTime)
      const back = joined(row.inDate, row.inTime)
      if (out && back && back <= out) issue(at('inTime'), 'Break in must be after break out')
      else if (out && checkIn && out < checkIn) issue(at('outTime'), 'Must be after check in')
      else if (back && checkOut && back > checkOut) issue(at('inTime'), 'Must be before check out')
    })
  })

export type DayEditValues = z.infer<typeof dayEditSchema>
export type BreakRowValues = z.infer<typeof breakRowSchema>

const MARK_OF: Record<DayMark, 'markAbsent' | 'markHalfDay' | 'markShortDay'> = {
  absent: 'markAbsent',
  half_day: 'markHalfDay',
  short_day: 'markShortDay',
}

export function toDayEditValues(detail: DayDetail): DayEditValues {
  const part = (value: LocalDateTime | null) => (value ? splitLocal(value) : { date: '', time: '' })
  const { day } = detail
  const checkIn = part(day.firstIn)
  const checkOut = part(day.lastOut)
  const mark = day.markedStatus ? MARK_OF[day.markedStatus] : null
  return {
    // A day without punches still offers its own date to start from.
    checkInDate: checkIn.date || day.workDate,
    checkInTime: checkIn.time,
    checkOutDate: checkOut.date || (day.firstIn ? '' : day.workDate),
    checkOutTime: checkOut.time,
    markAbsent: mark === 'markAbsent',
    markHalfDay: mark === 'markHalfDay',
    markShortDay: mark === 'markShortDay',
    breaks: detail.breaks.map((item) => {
      const out = splitLocal(item.outAt)
      const back = item.inAt ? splitLocal(item.inAt) : { date: '', time: '' }
      return {
        type: item.breakTypeId ?? '',
        outDate: out.date,
        outTime: out.time,
        inDate: back.date,
        inTime: back.time,
      }
    }),
    comments: day.comments ?? '',
  }
}

/** The form → `PUT /days/{..}`; the expected times and the rowVersion come from the day as read. */
export function toDayEditInput(values: DayEditValues, day: TimeSheetDay): DayEditInput {
  const absent = values.markAbsent
  const breaks = absent
    ? []
    : values.breaks.flatMap((row) => {
        const outAt = joined(row.outDate, row.outTime)
        if (!outAt) return []
        return [{ breakTypeId: row.type || null, outAt, inAt: joined(row.inDate, row.inTime) }]
      })
  const checkIn = joined(values.checkInDate, values.checkInTime)
  const markedStatus: DayMark | null = absent
    ? 'absent'
    : values.markHalfDay
      ? 'half_day'
      : values.markShortDay
        ? 'short_day'
        : null
  const comments = values.comments.trim()
  return {
    expectedIn: day.expectedIn,
    expectedOut: day.expectedOut,
    firstIn: absent ? null : checkIn,
    lastOut: absent || !checkIn ? null : joined(values.checkOutDate, values.checkOutTime),
    markedStatus,
    comments: comments === '' ? null : comments,
    breaks,
    rowVersion: day.rowVersion,
  }
}
