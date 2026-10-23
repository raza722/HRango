import { z } from 'zod'

import { toAmount } from '../utils/plan-math'

const amountText = (message: string, { positive = false, whole = false } = {}) =>
  z.string().superRefine((value, context) => {
    const number = toAmount(value)
    if (value.trim() === '' || !Number.isFinite(number)) {
      context.addIssue({ code: 'custom', message })
    } else if (number < 0 || (positive && number === 0)) {
      context.addIssue({ code: 'custom', message })
    } else if (whole && !Number.isInteger(number)) {
      context.addIssue({ code: 'custom', message: 'Enter a whole number' })
    }
  })

/** Add Budget Duration. */
export const durationFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter the budget duration')
      .max(40, 'Keep it under 40 characters'),
    startDate: z.string().min(1, 'Select the start date'),
    endDate: z.string().min(1, 'Select the end date'),
    isCurrent: z.boolean(),
  })
  .refine((value) => !value.startDate || !value.endDate || value.endDate > value.startDate, {
    path: ['endDate'],
    message: 'The end date must be after the start date',
  })
export type DurationFormValues = z.infer<typeof durationFormSchema>

/** Add Position Title. */
export const positionTitleFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Enter the position title')
    .max(60, 'Keep it under 60 characters'),
})
export type PositionTitleFormValues = z.infer<typeof positionTitleFormSchema>

/** The Employee Position popup. */
export const positionFormSchema = z
  .object({
    code: z.string().trim().max(20, 'Keep it under 20 characters'),
    positionTitleId: z.string().min(1, 'Choose the position title'),
    divisionId: z.string(),
    stationId: z.string().min(1, 'Choose the station'),
    departmentId: z.string(),
    subDepartmentId: z.string(),
    employeeGroupId: z.string().min(1, 'Choose the employee group'),
    costCenterId: z.string(),
    gradeId: z.string(),
    reportsToId: z.string(),
    minSalary: z.string(),
    maxSalary: amountText('Enter the maximum salary', { positive: true }),
  })
  .superRefine((value, context) => {
    if (value.minSalary.trim() === '') return
    const min = toAmount(value.minSalary)
    if (!Number.isFinite(min) || min < 0) {
      context.addIssue({ code: 'custom', path: ['minSalary'], message: 'Enter the minimum salary' })
      return
    }
    const max = toAmount(value.maxSalary)
    if (Number.isFinite(max) && min > max) {
      context.addIssue({
        code: 'custom',
        path: ['minSalary'],
        message: 'The minimum salary cannot be above the maximum',
      })
    }
  })
export type PositionFormValues = z.infer<typeof positionFormSchema>

/** Edit Budget (E-Budgeting ⋮ Edit). */
export const budgetFormSchema = z
  .object({
    amount: amountText('Enter the budget amount', { positive: true }),
    startDate: z.string().min(1, 'Select the start date'),
    endDate: z.string().min(1, 'Select the end date'),
  })
  .refine((value) => !value.startDate || !value.endDate || value.endDate >= value.startDate, {
    path: ['endDate'],
    message: 'The end date cannot be before the start date',
  })
export type BudgetFormValues = z.infer<typeof budgetFormSchema>

/** Edit Open Position. */
export const openPositionFormSchema = z.object({
  totalPositions: amountText('Enter the total positions', { positive: true, whole: true }),
  endDate: z.string().min(1, 'Select the end date'),
})
export type OpenPositionFormValues = z.infer<typeof openPositionFormSchema>
