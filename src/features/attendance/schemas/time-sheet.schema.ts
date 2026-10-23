import { z } from 'zod'

import type {
  AttendanceBreak,
  DayDetail,
  DayEditInput,
  LocalDateTime,
} from '../types/attendance.types'
import { ABSENCE_MARKS } from '../types/attendance.types'
import { splitLocal, toLocal } from '../utils/local-time'

const dateText = z.string()
const timeText = z.string()

export const breakRowSchema = z.object({
  type: z.string(),
  outDate: dateText,
  outTime: timeText,
  inDate: dateText,
  inTime: timeText,
  description: z.string().trim().max(200, 'Keep it under 200 characters'),
})

/** Combines a date and a time input; null when both are empty. */
function joined(date: string, time: string): LocalDateTime | null {
  return date && time ? toLocal(date, time) : null
}

/**
 * Time Sheet Edit: check in / out (date + time), Mark Absent / Half Day /
 * Short Day and the breaks. A date without a time (or the reverse) is
 * incomplete; check out must follow check in; each break must end after it
 * starts.
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
    breaks: z.array(breakRowSchema).max(20),
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
      if (!row.type) issue(at('type'), 'Choose a break type')
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

export function toDayEditValues(detail: DayDetail): DayEditValues {
  const part = (value: LocalDateTime | null) => (value ? splitLocal(value) : { date: '', time: '' })
  const checkIn = part(detail.day.checkIn)
  const checkOut = part(detail.day.checkOut)
  return {
    // A day without punches still offers its own date to start from.
    checkInDate: checkIn.date || detail.day.date,
    checkInTime: checkIn.time,
    checkOutDate: checkOut.date || (detail.day.checkIn ? '' : detail.day.date),
    checkOutTime: checkOut.time,
    markAbsent: detail.marks.absent,
    markHalfDay: detail.marks.halfDay,
    markShortDay: detail.marks.shortDay,
    breaks: detail.breaks.map((item) => {
      const out = splitLocal(item.outAt)
      const back = item.inAt ? splitLocal(item.inAt) : { date: '', time: '' }
      return {
        type: item.type,
        outDate: out.date,
        outTime: out.time,
        inDate: back.date,
        inTime: back.time,
        description: item.description,
      }
    }),
  }
}

export function toDayEditInput(values: DayEditValues): DayEditInput {
  const breaks: AttendanceBreak[] = values.breaks.flatMap((row) => {
    const outAt = joined(row.outDate, row.outTime)
    if (!row.type || !outAt) return []
    return [
      {
        type: row.type,
        outAt,
        inAt: joined(row.inDate, row.inTime),
        description: row.description.trim(),
      },
    ]
  })
  const absent = values.markAbsent
  const checkIn = joined(values.checkInDate, values.checkInTime)
  return {
    checkIn: absent ? null : checkIn,
    checkOut: absent || !checkIn ? null : joined(values.checkOutDate, values.checkOutTime),
    markAbsent: absent,
    markHalfDay: !absent && values.markHalfDay,
    markShortDay: !absent && values.markShortDay,
    breaks: absent ? [] : breaks,
  }
}

const reasonSchema = z
  .string()
  .trim()
  .min(1, 'Give a reason')
  .max(500, 'Keep it under 500 characters')

export const missingPunchSchema = z.object({
  type: z.enum(['check-in', 'check-out']),
  date: z.string().min(1, 'Choose the date'),
  time: z.string().min(1, 'Enter the time'),
  reason: reasonSchema,
})
export type MissingPunchValues = z.infer<typeof missingPunchSchema>

export const relaxationSchema = z.object({ reason: reasonSchema })
export type RelaxationValues = z.infer<typeof relaxationSchema>

export const absenceSchema = z.object({
  markAs: z.enum(ABSENCE_MARKS),
  reason: reasonSchema,
})
export type AbsenceValues = z.infer<typeof absenceSchema>

/** Overtime approval; the limit is the overtime worked that day. */
export function overtimeSchema(maxMinutes: number) {
  return z.object({
    minutes: z
      .string()
      .trim()
      .min(1, 'Enter the minutes to approve')
      .regex(/^\d+$/, 'Whole minutes only')
      .refine((value) => Number(value) >= 1, 'Approve at least 1 minute')
      .refine((value) => Number(value) <= maxMinutes, `At most ${maxMinutes} minutes`),
    reason: reasonSchema,
  })
}
export type OvertimeValues = z.infer<ReturnType<typeof overtimeSchema>>

export const commentSchema = z.object({
  text: z.string().trim().min(1, 'Type a comment first').max(500, 'Keep it under 500 characters'),
})
export type CommentValues = z.infer<typeof commentSchema>
