import { format } from 'date-fns'
import { z } from 'zod'

import { CATEGORY_VALUES } from '../categories'
import { ATTACHMENT_MAX_BYTES, NEW_HIRE_VALUES } from '../constants'

const date = (message: string) => z.string().min(1, message)

/** Start and end dates in order (either one missing is reported by its own field). */
function endsAfterStart(value: { startDate?: unknown; endDate?: unknown }): boolean {
  const { startDate, endDate } = value
  if (typeof startDate !== 'string' || typeof endDate !== 'string') return true
  return !startDate || !endDate || endDate > startDate
}

/** Today as `yyyy-MM-dd`. */
const todayIso = () => format(new Date(), 'yyyy-MM-dd')

// --- Plan year (New Plan Year page, Edit Plan Year dialog) ---------------------------------------

/** Another plan year, for the checks a new one is held to (its name and dates). */
export interface ExistingPlanYear {
  id: string
  name: string
  startDate: string
  endDate: string
}

/** The plan year the dates run into, if any (plan years cannot overlap). */
export function overlappingYear(
  value: { startDate: string; endDate: string },
  others: readonly ExistingPlanYear[],
): ExistingPlanYear | undefined {
  if (!value.startDate || !value.endDate || value.endDate <= value.startDate) return undefined
  return others.find(
    (other) => value.startDate <= other.endDate && value.endDate >= other.startDate,
  )
}

export const planYearFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter the plan year name')
      .max(60, 'Keep it under 60 characters'),
    startDate: date('Choose the start date'),
    endDate: date('Choose the end date'),
    planIds: z.array(z.string()).min(1, 'Choose at least one plan'),
    newHireStart: z.enum(NEW_HIRE_VALUES),
    /** Kept as typed; the number is checked here. */
    electionPeriod: z
      .string()
      .trim()
      .min(1, 'Enter how long')
      .refine((value) => /^\d+$/.test(value), 'Enter a whole number')
      .refine((value) => Number(value) >= 1 && Number(value) <= 365, 'Enter 1 to 365'),
    electionUnit: z.enum(['day', 'week', 'month']),
    /** Days; asked only for "After a waiting period". */
    waitingPeriodDays: z.string().trim(),
  })
  .refine((value) => endsAfterStart(value), {
    message: 'The plan year must end after it starts',
    path: ['endDate'],
    // Checked even while other steps' fields are still empty.
    when: () => true,
  })
  .refine(
    (value) =>
      value.newHireStart !== 'waiting_period' ||
      (/^\d+$/.test(value.waitingPeriodDays) &&
        Number(value.waitingPeriodDays) >= 1 &&
        Number(value.waitingPeriodDays) <= 365),
    {
      message: 'Enter the waiting period: 1 to 365 days',
      path: ['waitingPeriodDays'],
      when: () => true,
    },
  )
export type PlanYearFormValues = z.infer<typeof planYearFormSchema>

/**
 * The plan year form, checked against the other plan years: its name is new and its dates
 * do not overlap theirs. Both are checked on the Details step, before Plans opens.
 */
export const planYearSchemaFor = (others: readonly ExistingPlanYear[]) =>
  planYearFormSchema
    .refine(
      (value) =>
        !others.some(
          (other) => other.name.trim().toLowerCase() === value.name.trim().toLowerCase(),
        ),
      { message: 'A plan year with this name already exists.', path: ['name'], when: () => true },
    )
    .refine((value) => overlappingYear(value, others) === undefined, {
      path: ['startDate'],
      when: () => true,
      error: (issue) => {
        const other = overlappingYear(issue.input as { startDate: string; endDate: string }, others)
        return `These dates overlap ${other?.name ?? 'another plan year'}${other ? ` (${other.startDate} to ${other.endDate})` : ''}. Plan years cannot overlap.`
      },
    })

/** The fields each step checks before the next one opens. */
export const PLAN_YEAR_STEP_FIELDS = {
  details: ['name', 'startDate', 'endDate'],
  plans: ['planIds'],
  'new-hires': ['newHireStart', 'waitingPeriodDays', 'electionPeriod', 'electionUnit'],
} as const satisfies Record<string, readonly (keyof PlanYearFormValues)[]>

// --- Plan (Add Medical Plan …) ------------------------------------------------------------------

export const planFormSchema = z
  .object({
    category: z.enum(CATEGORY_VALUES),
    name: z.string().trim().min(1, 'Enter the plan name').max(60, 'Keep it under 60 characters'),
    planType: z.string().min(1, 'Choose the plan type'),
    planTypeRef: z
      .string()
      .trim()
      .min(1, 'Enter the plan type ID')
      .max(50, 'Keep it under 50 characters'),
    carrier: z.string().min(1, 'Choose the carrier'),
    startDate: date('Choose when the plan starts'),
    endDate: date('Choose when the plan ends'),
    description: z.string().trim().max(4000, 'Keep it under 4000 characters'),
    /** Optional: uploaded and attached once the plan is saved. */
    attachment: z
      .instanceof(File)
      .nullable()
      .refine(
        (file) => file === null || file.size <= ATTACHMENT_MAX_BYTES,
        'The file must be 5 MB or smaller',
      ),
  })
  .refine((value) => endsAfterStart(value), {
    message: 'The plan must end after it starts',
    path: ['endDate'],
    when: () => true,
  })
export type PlanFormValues = z.infer<typeof planFormSchema>

// --- New Open Enrollment Window -----------------------------------------------------------------

export const enrollmentWindowFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter the enrollment name')
      .max(80, 'Keep it under 80 characters'),
    planYearId: z.string().min(1, 'Choose the plan year'),
    effectiveDate: date('Choose when it becomes effective'),
    closesOn: date('Choose the last day of enrollment'),
    planIds: z.array(z.string()).min(1, 'Choose at least one plan'),
    /** Nobody chosen: everyone may enrol. */
    employeeIds: z.array(z.string()),
  })
  // A new window starts today or later, and people can still enrol on its last day.
  .refine((value) => !value.effectiveDate || value.effectiveDate >= todayIso(), {
    message: 'Choose today or a later day',
    path: ['effectiveDate'],
    when: () => true,
  })
  .refine((value) => !value.closesOn || value.closesOn >= todayIso(), {
    message: 'Choose today or a later day',
    path: ['closesOn'],
    when: () => true,
  })
export type EnrollmentWindowFormValues = z.infer<typeof enrollmentWindowFormSchema>

export const ENROLLMENT_STEP_ONE_FIELDS = [
  'name',
  'planYearId',
  'effectiveDate',
  'closesOn',
  'planIds',
] as const satisfies readonly (keyof EnrollmentWindowFormValues)[]

// --- Update missing information -----------------------------------------------------------------

export const profileFormSchema = z.object({
  dateOfBirth: date('Choose the date of birth'),
  maritalStatus: z.string().min(1, 'Choose the marital status'),
  /** Optional: Employees keeps it with the person's contact details. */
  homeAddress: z.string().trim().max(500, 'Keep it under 500 characters'),
})
export type ProfileFormValues = z.infer<typeof profileFormSchema>
