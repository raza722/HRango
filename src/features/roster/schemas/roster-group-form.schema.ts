import { z } from 'zod'

import { ROSTER_TITLE_MAX_LENGTH } from '../constants'
import { ROSTER_DAYS } from '../types/roster.types'

/** `HH:mm` from `<input type="time">`, or '' when not set. */
const timeValue = z.string().regex(/^(?:([01]\d|2[0-3]):[0-5]\d)?$/, 'Enter a valid time')

const dayFormSchema = z.object({
  day: z.enum(ROSTER_DAYS),
  isWeekend: z.boolean(),
  clockIn: timeValue,
  clockOut: timeValue,
})

export type RosterDayFormValues = z.infer<typeof dayFormSchema>

/**
 * "Add Roster Group": title, status, default times (with "Apply For All")
 * and the seven days. Times stay strings, as the inputs hold them.
 */
export const rosterGroupFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Enter the group title')
      .max(ROSTER_TITLE_MAX_LENGTH, `Use at most ${ROSTER_TITLE_MAX_LENGTH} characters`),
    isActive: z.boolean(),
    clockIn: timeValue,
    clockOut: timeValue,
    applyToAll: z.boolean(),
    days: z.array(dayFormSchema).length(ROSTER_DAYS.length),
  })
  .superRefine((values, ctx) => {
    const issue = (path: (string | number)[], message: string) => {
      ctx.addIssue({ code: 'custom', path, message })
    }

    // The default pair is optional, but "Apply For All" needs it.
    if (values.applyToAll || values.clockIn || values.clockOut) {
      if (!values.clockIn) issue(['clockIn'], 'Enter the clock in time')
      if (!values.clockOut) issue(['clockOut'], 'Enter the clock out time')
    }
    if (values.clockIn && values.clockIn === values.clockOut) {
      issue(['clockOut'], 'Clock out must differ from clock in')
    }

    if (values.days.every((day) => day.isWeekend)) {
      issue(['days'], 'Keep at least one working day')
    }
    values.days.forEach((day, index) => {
      // With "Apply For All" the days copy the default pair checked above.
      if (day.isWeekend || values.applyToAll) return
      if (!day.clockIn) issue(['days', index, 'clockIn'], 'Required')
      if (!day.clockOut) issue(['days', index, 'clockOut'], 'Required')
      if (day.clockIn && day.clockIn === day.clockOut) {
        issue(['days', index, 'clockOut'], 'Must differ from clock in')
      }
    })
  })

export type RosterGroupFormValues = z.infer<typeof rosterGroupFormSchema>
