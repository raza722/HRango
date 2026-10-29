import { z } from 'zod'

import {
  GENDERS,
  HIRE_STATUSES,
  INTERVIEW_MODES,
  INTERVIEW_RESULTS,
  MOVE_STAGES,
  RECOMMENDATIONS,
  SALARY_FREQUENCIES,
  SOURCES,
  WORK_MODES,
} from '../types/recruitment.types'

/*
 * The Recruitment forms. Boxes hold text ('' for nothing); pickers hold an id or null. The limits
 * are the API's (OpenAPI `maxLength`, `minimum` …), so most mistakes are caught before a save.
 */

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${String(max)} characters`)
const required = (message: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, message)
    .max(max, `Keep it under ${String(max)} characters`)
const picker = z.string().nullable()
const isDay = (value: string) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value)
const day = z.string().refine(isDay, 'Choose a date')
/** Today as `yyyy-MM-dd` (local), read when a form is checked. */
const todayDay = () => {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
/** A date that is today or later ('' passes; `required` is checked on its own). */
const notPast = (value: string) => value === '' || value >= todayDay()

/** First and last names: at most 100 characters. */
export const NAME_MAX = 100
/** Digits with + ( ) - and spaces, 5 to 30 of them (as Talent Management). */
const phoneBox = optional(30).refine(
  (value) => value === '' || /^[0-9+()\-\s]{5,30}$/.test(value),
  'Enter a valid phone number',
)

const clean = (value: string) => value.replace(/,/g, '').trim()

/** A number box: '' or a number between `min` and `max` (whole when `integer`). */
function numberBox({
  min,
  max,
  integer = false,
  label,
}: {
  min: number
  max?: number
  integer?: boolean
  label: string
}) {
  return z.string().refine(
    (value) => {
      const text = clean(value)
      if (text === '') return true
      const number = Number(text)
      if (!Number.isFinite(number) || number < min) return false
      if (max !== undefined && number > max) return false
      return !integer || Number.isInteger(number)
    },
    `${label} must be ${integer ? 'a whole number' : 'a number'} ${max === undefined ? `of ${String(min)} or more` : `from ${String(min)} to ${String(max)}`}`,
  )
}

const num = (value: string) => (clean(value) === '' ? null : Number(clean(value)))

// --- openings -----------------------------------------------------------------------------------

export const openingFormSchema = z
  .object({
    title: required('Enter the job title of the opening', 200),
    code: optional(30),
    openPositionId: picker,
    jobTitleId: picker,
    designationId: picker,
    departmentId: picker,
    branchId: picker,
    employmentTypeId: picker,
    hiringManagerId: picker,
    cityId: picker,
    workMode: z.union([z.enum(WORK_MODES), z.literal('')]),
    experienceFromYears: numberBox({ min: 0, max: 60, integer: true, label: 'Experience' }),
    experienceToYears: numberBox({ min: 0, max: 60, integer: true, label: 'Experience' }),
    vacancies: z
      .string()
      .min(1, 'Enter how many people to hire')
      .pipe(numberBox({ min: 1, max: 10000, integer: true, label: 'Vacancies' })),
    postedOn: day,
    applyBy: day,
    closeOn: day,
    salaryFrom: numberBox({ min: 0, label: 'Salary' }),
    salaryTo: numberBox({ min: 0, label: 'Salary' }),
    isSalaryVisible: z.boolean(),
    description: optional(8000),
    requirements: optional(8000),
  })
  .superRefine((values, ctx) => {
    const from = num(values.experienceFromYears)
    const to = num(values.experienceToYears)
    if (from !== null && to !== null && to < from) {
      ctx.addIssue({
        code: 'custom',
        path: ['experienceToYears'],
        message: 'Must be at least the minimum',
      })
    }
    const salaryFrom = num(values.salaryFrom)
    const salaryTo = num(values.salaryTo)
    if (salaryFrom !== null && salaryTo !== null && salaryTo < salaryFrom) {
      ctx.addIssue({
        code: 'custom',
        path: ['salaryTo'],
        message: 'Must be at least the minimum salary',
      })
    }
    if (values.postedOn && values.applyBy && values.applyBy < values.postedOn) {
      ctx.addIssue({
        code: 'custom',
        path: ['applyBy'],
        message: 'Cannot be before the posting date',
      })
    }
    const after = values.applyBy || values.postedOn
    if (after && values.closeOn && values.closeOn < after) {
      ctx.addIssue({
        code: 'custom',
        path: ['closeOn'],
        message: values.applyBy
          ? 'Cannot be before the apply-by date'
          : 'Cannot be before the posting date',
      })
    }
  })
export type OpeningFormValues = z.infer<typeof openingFormSchema>

// --- applicants ---------------------------------------------------------------------------------

/** First, last name and email: the applicant itself and New Application's "new candidate". */
const applicantCore = {
  firstName: required('Enter the first name', NAME_MAX),
  lastName: required('Enter the last name', NAME_MAX),
  email: z
    .string()
    .trim()
    .min(1, 'Enter the email address')
    .max(254, 'Keep it under 254 characters')
    .pipe(z.email('Enter a valid email address')),
  phone: phoneBox,
}

export const applicantFormSchema = z
  .object({
    ...applicantCore,
    gender: z.union([z.enum(GENDERS), z.literal('')]),
    dateOfBirth: day,
    cityId: picker,
    address: optional(500),
    currentEmployer: optional(200),
    currentJobTitle: optional(200),
    experienceYears: numberBox({ min: 0, max: 99, label: 'Experience' }),
    currentSalary: numberBox({ min: 0, label: 'Salary' }),
    expectedSalary: numberBox({ min: 0, label: 'Salary' }),
    noticePeriodDays: numberBox({ min: 0, max: 365, integer: true, label: 'Notice period' }),
    highestEducation: optional(200),
    linkedinUrl: optional(500).refine(
      (value) => value === '' || /^https?:\/\/\S+$/i.test(value),
      'Enter a link starting with https://',
    ),
    source: z.union([z.enum(SOURCES), z.literal('')]),
    referredByEmployeeId: picker,
    notes: optional(8000),
  })
  .superRefine((values, ctx) => {
    if (values.source === 'referral' && !values.referredByEmployeeId) {
      ctx.addIssue({
        code: 'custom',
        path: ['referredByEmployeeId'],
        message: 'Choose who referred them',
      })
    }
  })
export type ApplicantFormValues = z.infer<typeof applicantFormSchema>

// --- applications -------------------------------------------------------------------------------

const newCandidate = z.object(applicantCore)

/** New Application: an existing candidate, or a new one's name, email and phone. */
export const applicationFormSchema = z
  .object({
    jobOpeningId: picker.refine((value) => !!value, 'Choose the job opening'),
    who: z.enum(['existing', 'new']),
    applicantId: picker,
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    phone: z.string(),
    appliedOn: day,
    source: z.union([z.enum(SOURCES), z.literal('')]),
    coverLetter: optional(8000),
    remarks: optional(4000),
  })
  .superRefine((values, ctx) => {
    if (values.who === 'existing') {
      if (!values.applicantId) {
        ctx.addIssue({ code: 'custom', path: ['applicantId'], message: 'Choose the candidate' })
      }
      return
    }
    const checked = newCandidate.safeParse(values)
    if (checked.success) return
    for (const issue of checked.error.issues) {
      ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message })
    }
  })
export type ApplicationFormValues = z.infer<typeof applicationFormSchema>

export const moveFormSchema = z.object({
  stage: z.enum(MOVE_STAGES, { error: 'Choose the stage' }),
  remarks: optional(4000),
})
export type MoveFormValues = z.infer<typeof moveFormSchema>

export const rejectFormSchema = z.object({
  rejectionReasonId: picker.refine((value) => !!value, 'Choose the reason'),
  remarks: optional(4000),
})
export type RejectFormValues = z.infer<typeof rejectFormSchema>

/** Remarks for Withdraw, Cancel Interview, Send / Withdraw Offer; `required` asks for them. */
export const remarksFormSchema = (requiredMessage?: string) =>
  z.object({
    remarks: requiredMessage ? required(requiredMessage, 4000) : optional(4000),
  })
export type RemarksFormValues = z.infer<ReturnType<typeof remarksFormSchema>>

const hireObject = z
  .object({
    code: optional(30),
    joiningDate: day.refine((value) => value !== '', 'Choose the joining date'),
    branchId: picker,
    departmentId: picker,
    designationId: picker,
    jobTitleId: picker,
    employmentTypeId: picker,
    lineManagerId: picker,
    salary: numberBox({ min: 0, label: 'Salary' }),
    status: z.enum(HIRE_STATUSES),
    probationEndDate: day,
    cnic: optional(15).refine(
      (value) => value === '' || /^\d{5}-?\d{7}-?\d$/.test(value),
      'Enter the CNIC as 35202-1234567-1',
    ),
    remarks: optional(4000),
  })
  .superRefine((values, ctx) => {
    if (
      values.probationEndDate &&
      values.joiningDate &&
      values.probationEndDate < values.joiningDate
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['probationEndDate'],
        message: 'Cannot be before the joining date',
      })
    }
  })
export const hireFormSchema = hireObject
export type HireFormValues = z.infer<typeof hireObject>

/** Hire, with Branch required when neither the accepted offer nor the opening names one. */
export const makeHireFormSchema = ({ branchRequired }: { branchRequired: boolean }) =>
  hireObject.superRefine((values, ctx) => {
    if (branchRequired && !values.branchId) {
      ctx.addIssue({
        code: 'custom',
        path: ['branchId'],
        message: 'Choose the branch: the opening has none',
      })
    }
  })

// --- interviews ---------------------------------------------------------------------------------

export const interviewFormSchema = z
  .object({
    applicationId: picker.refine((value) => !!value, 'Choose the application'),
    title: optional(200),
    mode: z.enum(INTERVIEW_MODES),
    date: day
      .refine((value) => value !== '', 'Choose the date')
      .refine(notPast, 'Choose today or a later date'),
    time: z.string().regex(/^\d{2}:\d{2}$/, 'Choose the time'),
    durationMinutes: z
      .string()
      .min(1, 'Enter how long it takes')
      .pipe(numberBox({ min: 5, max: 600, integer: true, label: 'Duration' })),
    venue: optional(500),
    interviewerIds: z.array(z.string()).min(1, 'Choose at least one interviewer'),
    remarks: optional(4000),
  })
  .superRefine((values, ctx) => {
    // Today's date with a time already gone.
    if (values.date !== todayDay() || !/^\d{2}:\d{2}$/.test(values.time)) return
    const [hours = 0, minutes = 0] = values.time.split(':').map(Number)
    const at = new Date()
    at.setHours(hours, minutes, 0, 0)
    if (at.getTime() < Date.now() - 60_000) {
      ctx.addIssue({ code: 'custom', path: ['time'], message: 'This time has already passed' })
    }
  })
export type InterviewFormValues = z.infer<typeof interviewFormSchema>

export const completeFormSchema = z
  .object({
    status: z.enum(['completed', 'no_show']),
    result: z.union([z.enum(INTERVIEW_RESULTS), z.literal('')]),
    remarks: optional(4000),
  })
  .superRefine((values, ctx) => {
    if (values.status === 'completed' && !values.result) {
      ctx.addIssue({ code: 'custom', path: ['result'], message: 'Choose the result' })
    }
  })
export type CompleteFormValues = z.infer<typeof completeFormSchema>

export const evaluationFormSchema = z.object({
  employeeId: picker.refine((value) => !!value, 'Choose the interviewer'),
  rating: z.number({ error: 'Choose a rating' }).int().min(1, 'Choose a rating').max(5),
  recommendation: z.enum(RECOMMENDATIONS, { error: 'Choose a recommendation' }),
  strengths: optional(4000),
  concerns: optional(4000),
  comments: optional(4000),
})
export type EvaluationFormValues = z.infer<typeof evaluationFormSchema>

// --- offers -------------------------------------------------------------------------------------

export const offerFormSchema = z
  .object({
    applicationId: picker.refine((value) => !!value, 'Choose the application'),
    jobTitleId: picker,
    designationId: picker,
    departmentId: picker,
    branchId: picker,
    employmentTypeId: picker,
    offeredSalary: z
      .string()
      .min(1, 'Enter the offered salary')
      .pipe(numberBox({ min: 0, label: 'Salary' }))
      .refine((value) => (num(value) ?? 0) > 0, 'Enter the offered salary'),
    salaryFrequency: z.enum(SALARY_FREQUENCIES),
    joiningDate: day
      .refine((value) => value !== '', 'Choose the joining date')
      .refine(notPast, 'Choose today or a later date'),
    probationMonths: numberBox({ min: 0, max: 24, integer: true, label: 'Probation' }),
    expiresOn: day.refine(notPast, 'Choose today or a later date'),
    remarks: optional(4000),
  })
  .superRefine((values, ctx) => {
    if (values.expiresOn && values.joiningDate && values.expiresOn > values.joiningDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['expiresOn'],
        message: 'Must be on or before the joining date',
      })
    }
  })
export type OfferFormValues = z.infer<typeof offerFormSchema>

export const respondFormSchema = z.object({
  decision: z.enum(['accepted', 'declined'], { error: 'Choose the answer' }),
  remarks: optional(4000),
})
export type RespondFormValues = z.infer<typeof respondFormSchema>

// --- settings -----------------------------------------------------------------------------------

export const rejectionReasonFormSchema = z.object({
  name: required('Enter the reason', 200),
  isActive: z.boolean(),
  sortOrder: numberBox({ min: 0, max: 9999, integer: true, label: 'Order' }),
})
export type RejectionReasonFormValues = z.infer<typeof rejectionReasonFormSchema>

/** Text boxes → numbers for the API (null when empty). */
export const toNumber = num
