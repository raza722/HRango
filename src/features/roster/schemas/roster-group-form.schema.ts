import { z } from 'zod'

import { ROSTER_DESCRIPTION_MAX_LENGTH, ROSTER_TITLE_MAX_LENGTH } from '../constants'
import { ROSTER_DAYS } from '../types/roster.types'

const dayFormSchema = z.object({
  day: z.enum(ROSTER_DAYS),
  /** A day off has no time slot. */
  isDayOff: z.boolean(),
  /** Time slot id, or '' when not chosen. */
  timeSlotId: z.string(),
})

export type RosterDayFormValues = z.infer<typeof dayFormSchema>

/**
 * "Add Roster Group": title, period, status, description, a default time slot (with
 * "Apply For All") and the seven days, each a time slot or a day off.
 */
export const rosterGroupFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Enter the group title')
      .max(ROSTER_TITLE_MAX_LENGTH, `Use at most ${ROSTER_TITLE_MAX_LENGTH} characters`),
    /** `yyyy-MM-dd`. */
    fromDate: z.string().min(1, 'Pick the date the roster starts'),
    /** `yyyy-MM-dd`, or '' for open-ended. */
    toDate: z.string(),
    description: z
      .string()
      .max(
        ROSTER_DESCRIPTION_MAX_LENGTH,
        `Use at most ${ROSTER_DESCRIPTION_MAX_LENGTH} characters`,
      ),
    isActive: z.boolean(),
    /** Form only: the slot "Apply For All" copies to every working day. */
    defaultTimeSlotId: z.string(),
    applyToAll: z.boolean(),
    days: z.array(dayFormSchema).length(ROSTER_DAYS.length),
  })
  .superRefine((values, ctx) => {
    const issue = (path: (string | number)[], message: string) => {
      ctx.addIssue({ code: 'custom', path, message })
    }
    // Both are `yyyy-MM-dd`, so they compare as text.
    if (values.toDate && values.fromDate && values.toDate < values.fromDate) {
      issue(['toDate'], 'Pick a date on or after the start date')
    }
    if (values.applyToAll && !values.defaultTimeSlotId) {
      issue(['defaultTimeSlotId'], 'Select the time slot to apply')
    }
    if (values.days.every((day) => day.isDayOff)) {
      issue(['days'], 'Keep at least one working day')
    }
    values.days.forEach((day, index) => {
      // With "Apply For All" the days copy the default slot checked above.
      if (day.isDayOff || values.applyToAll) return
      if (!day.timeSlotId) issue(['days', index, 'timeSlotId'], 'Select a time slot')
    })
  })

export type RosterGroupFormValues = z.infer<typeof rosterGroupFormSchema>
