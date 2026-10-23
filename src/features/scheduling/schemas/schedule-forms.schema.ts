import { z } from 'zod'

import { BREAK_TYPES, WEEKDAYS } from '../types/scheduling.types'

const required = (message: string) => z.string().min(1, message)
const time = z.string().regex(/^(?:([01]\d|2[0-3]):[0-5]\d)?$/, 'Enter a valid time')
const hours = z
  .string()
  .trim()
  .regex(/^(?:\d{1,3}(?:\.\d{1,2})?)?$/, 'Enter hours, e.g. 8 or 7.5')

export const breakRowSchema = z.object({
  type: z.enum(BREAK_TYPES),
  startDate: required('Pick the start date'),
  endDate: required('Pick the end date'),
  startTime: required('Required').pipe(time),
  endTime: required('Required').pipe(time),
  description: z.string().max(200, 'Use at most 200 characters'),
  inclusive: z.boolean(),
})

export type BreakRowValues = z.infer<typeof breakRowSchema>

const repeatFields = {
  /** "0" = None, "1"…"8" = every N weeks. */
  repeat: z.string(),
  repeatFrom: z.string(),
  repeatTo: z.string(),
  weekdays: z.array(z.enum(WEEKDAYS)),
  step: z.string().trim(),
}

type Issue = (path: (string | number)[], message: string) => void

function checkRepeat(
  values: {
    repeat: string
    repeatFrom: string
    repeatTo: string
    weekdays: string[]
    step: string
  },
  issue: Issue,
  required: boolean,
) {
  const every = Number(values.repeat)
  if (!required && every === 0) return
  if (required && every === 0) issue(['repeat'], 'Select how often it repeats')
  if (!values.repeatFrom) issue(['repeatFrom'], 'Pick the first date')
  if (!values.repeatTo) issue(['repeatTo'], 'Pick the last date')
  if (values.repeatFrom && values.repeatTo && values.repeatTo < values.repeatFrom) {
    issue(['repeatTo'], 'Pick a date on or after the first date')
  }
  if (values.weekdays.length === 0) issue(['weekdays'], 'Pick at least one day')
  if (values.step !== '') {
    const step = Number(values.step)
    if (!Number.isInteger(step) || step < 1 || (every > 0 && step > every)) {
      issue(['step'], every > 0 ? `Use a whole number from 1 to ${every}` : 'Use a whole number')
    }
  }
}

const stepOneFields = {
  startDate: required('Pick the start date'),
  endDate: required('Pick the end date'),
  rosterGroupId: required('Select a time roster'),
  geoFenceIds: z.array(z.string()),
  ...repeatFields,
  restDays: z.boolean(),
  breaks: z.array(breakRowSchema).max(20),
}

function checkStepOne(values: z.infer<z.ZodObject<typeof stepOneFields>>, issue: Issue) {
  if (values.startDate && values.endDate && values.endDate < values.startDate) {
    issue(['endDate'], 'Pick a date on or after the start date')
  }
  checkRepeat(values, issue, false)
  values.breaks.forEach((row, index) => {
    if (row.startDate && row.endDate && row.endDate < row.startDate) {
      issue(['breaks', index, 'endDate'], 'Ends before it starts')
    }
    if (row.startTime && row.startTime === row.endTime) {
      issue(['breaks', index, 'endTime'], 'Must differ from the start')
    }
  })
}

/** Create Scheduling, step 1: dates, time roster, geo fences, repeat, rest days, breaks. */
export const createStepOneSchema = z.object(stepOneFields).superRefine((values, ctx) => {
  checkStepOne(values, (path, message) => {
    ctx.addIssue({ code: 'custom', path, message })
  })
})

/**
 * Create Scheduling, both steps in one form. Step 2 adds the time slot rules,
 * work from home and the employees. Values stay strings, as the inputs hold them.
 */
export const createScheduleSchema = z
  .object({
    ...stepOneFields,
    workFromHome: z.boolean(),
    slotName: z
      .string()
      .trim()
      .min(1, 'Enter the time slot name')
      .max(60, 'Use at most 60 characters'),
    startTime: required('Enter the start time').pipe(time),
    endTime: required('Enter the end time').pipe(time),
    isOvernight: z.boolean(),
    reverseDecision: z.boolean(),
    /** "Total Duration" tick: the slot counts hours instead of fixed clock times. */
    durationRules: z.boolean(),
    mode: z.enum(['flexible', 'total']),
    workableHours: hours,
    totalHours: hours,
    shortOvertime: z.boolean(),
    fullOvertime: z.boolean(),
    /** `HH:mm` allowance when an overtime box is ticked. */
    overtime: time,
    employeeIds: z.array(z.string()).min(1, 'Select at least one employee'),
  })
  .superRefine((values, ctx) => {
    const issue: Issue = (path, message) => {
      ctx.addIssue({ code: 'custom', path, message })
    }
    checkStepOne(values, issue)
    if (values.startTime && values.startTime === values.endTime) {
      issue(['endTime'], 'Must differ from the start time')
    }
    if (values.durationRules) {
      const field = values.mode === 'flexible' ? 'workableHours' : 'totalHours'
      const amount = Number(values[field])
      const limit = values.mode === 'flexible' ? 24 : 200
      if (values[field] === '' || amount <= 0 || amount > limit) {
        issue([field], `Enter hours from 0.5 to ${limit}`)
      }
    }
    if ((values.shortOvertime || values.fullOvertime) && !values.overtime) {
      issue(['overtime'], 'Enter the overtime allowance')
    }
  })

export type CreateScheduleValues = z.infer<typeof createScheduleSchema>

/** Apply Default Shift, step 1. */
export const applyDefaultSchema = z
  .object({
    startDate: required('Pick the start date'),
    endDate: required('Pick the end date'),
    rosterGroupId: required('Select a roster group'),
    employeeIds: z.array(z.string()).min(1, 'Select at least one employee'),
  })
  .refine((values) => !values.startDate || !values.endDate || values.endDate >= values.startDate, {
    path: ['endDate'],
    message: 'Pick a date on or after the start date',
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
    if (values.startDate && values.endDate && values.endDate < values.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'Pick a date on or after the start date',
      })
    }
    if (!values.allEmployees && values.employeeIds.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['employeeIds'],
        message: 'Select at least one employee',
      })
    }
  })

export type DeleteScheduleValues = z.infer<typeof deleteScheduleSchema>

/** Create New Rest Day. */
export const restDaySchema = z
  .object({
    startDate: required('Pick the start date'),
    ...repeatFields,
    payable: z.boolean(),
    employeeIds: z.array(z.string()).min(1, 'Select at least one employee'),
  })
  .superRefine((values, ctx) => {
    checkRepeat(
      values,
      (path, message) => {
        ctx.addIssue({ code: 'custom', path, message })
      },
      true,
    )
  })

export type RestDayValues = z.infer<typeof restDaySchema>
