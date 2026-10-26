import { z } from 'zod'

import { WEEKDAYS } from '../types/scheduling.types'

const required = (message: string) => z.string().min(1, message)
const time = z.string().regex(/^(?:([01]\d|2[0-3]):[0-5]\d)?$/, 'Enter a valid time')

/** A break row: a break type from Scheduling settings and its times. */
export const breakRowSchema = z.object({
  breakTypeId: required('Select the break type'),
  startTime: required('Required').pipe(time),
  endTime: required('Required').pipe(time),
  isInclusive: z.boolean(),
})

export type BreakRowValues = z.infer<typeof breakRowSchema>

const repeatFields = {
  /** "0" = None (every week), "1"…"8" = every N weeks: the API's `repeatEveryWeeks`. */
  repeat: z.string(),
  weekdays: z.array(z.enum(WEEKDAYS)),
  step: z.string().trim(),
}

type Issue = (path: (string | number)[], message: string) => void

function checkRange(values: { startDate: string; endDate: string }, issue: Issue) {
  // Both are `yyyy-MM-dd`, so they compare as text.
  if (values.startDate && values.endDate && values.endDate < values.startDate) {
    issue(['endDate'], 'Pick a date on or after the start date')
  }
}

function checkRepeat(values: { repeat: string; weekdays: string[]; step: string }, issue: Issue) {
  const every = Number(values.repeat)
  if (values.weekdays.length === 0) issue(['weekdays'], 'Pick at least one day')
  if (every > 0 && values.step !== '') {
    const step = Number(values.step)
    if (!Number.isInteger(step) || step < 1 || step > every) {
      issue(['step'], `Use a whole number from 1 to ${every}`)
    }
  }
}

const stepOneFields = {
  startDate: required('Pick the start date'),
  endDate: required('Pick the end date'),
  /** Shifts from one time slot, or from a roster group's week. */
  source: z.enum(['timeSlot', 'roster']),
  timeSlotId: z.string(),
  rosterGroupId: z.string(),
  /** '' = no geo fence. */
  geoFenceId: z.string(),
  ...repeatFields,
  /** Replaces the slots' breaks on every shift; none keeps them. */
  breaks: z.array(breakRowSchema).max(20),
}

type StepOneValues = z.infer<z.ZodObject<typeof stepOneFields>>

function checkStepOne(values: StepOneValues, issue: Issue) {
  checkRange(values, issue)
  if (values.source === 'timeSlot' && !values.timeSlotId) {
    issue(['timeSlotId'], 'Select a time slot')
  }
  if (values.source === 'roster' && !values.rosterGroupId) {
    issue(['rosterGroupId'], 'Select a time roster')
  }
  checkRepeat(values, issue)
  values.breaks.forEach((row, index) => {
    if (row.startTime && row.startTime === row.endTime) {
      issue(['breaks', index, 'endTime'], 'Must differ from the start')
    }
  })
}

/** Create Scheduling, step 1: dates, time slot or roster, geo fence, repeat, breaks. */
export const createStepOneSchema = z.object(stepOneFields).superRefine((values, ctx) => {
  checkStepOne(values, (path, message) => {
    ctx.addIssue({ code: 'custom', path, message })
  })
})

/**
 * Create Scheduling, both steps in one form. Step 2 adds work from home, "replace what is
 * planned" and the employees (optional with a roster: its members are scheduled).
 */
export const createScheduleSchema = z
  .object({
    ...stepOneFields,
    workFromHome: z.boolean(),
    replaceExisting: z.boolean(),
    employeeIds: z.array(z.string()),
  })
  .superRefine((values, ctx) => {
    const issue: Issue = (path, message) => {
      ctx.addIssue({ code: 'custom', path, message })
    }
    checkStepOne(values, issue)
    if (values.source === 'timeSlot' && values.employeeIds.length === 0) {
      issue(['employeeIds'], 'Select at least one employee')
    }
  })

export type CreateScheduleValues = z.infer<typeof createScheduleSchema>

/** Apply Default Shift: dates, then the employees (each gets their roster or default slot). */
export const applyDefaultSchema = z
  .object({
    startDate: required('Pick the start date'),
    endDate: required('Pick the end date'),
    replaceExisting: z.boolean(),
    employeeIds: z.array(z.string()).min(1, 'Select at least one employee'),
  })
  .superRefine((values, ctx) => {
    checkRange(values, (path, message) => {
      ctx.addIssue({ code: 'custom', path, message })
    })
  })

export type ApplyDefaultValues = z.infer<typeof applyDefaultSchema>

/** Delete Scheduling. */
export const deleteScheduleSchema = z
  .object({
    startDate: required('Pick the start date'),
    endDate: required('Pick the end date'),
    deleteRestDays: z.boolean(),
    allEmployees: z.boolean(),
    employeeIds: z.array(z.string()),
  })
  .superRefine((values, ctx) => {
    checkRange(values, (path, message) => {
      ctx.addIssue({ code: 'custom', path, message })
    })
    if (!values.allEmployees && values.employeeIds.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['employeeIds'],
        message: 'Select at least one employee',
      })
    }
  })

export type DeleteScheduleValues = z.infer<typeof deleteScheduleSchema>

/** Create New Rest Day: a rest-day rule (`POST /scheduling/settings/rest-days`). */
export const restDaySchema = z
  .object({
    fromDate: required('Pick the first date'),
    toDate: required('Pick the last date'),
    ...repeatFields,
    payable: z.boolean(),
    employeeIds: z.array(z.string()).min(1, 'Select at least one employee'),
  })
  .superRefine((values, ctx) => {
    const issue: Issue = (path, message) => {
      ctx.addIssue({ code: 'custom', path, message })
    }
    if (values.fromDate && values.toDate && values.toDate < values.fromDate) {
      issue(['toDate'], 'Pick a date on or after the first date')
    }
    checkRepeat(values, issue)
  })

export type RestDayValues = z.infer<typeof restDaySchema>
