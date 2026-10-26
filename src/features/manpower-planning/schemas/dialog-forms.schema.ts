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
      .max(200, 'Keep it under 200 characters'),
    startDate: z.string().min(1, 'Select the start date'),
    endDate: z.string().min(1, 'Select the end date'),
    isCurrent: z.boolean(),
  })
  .refine((value) => !value.startDate || !value.endDate || value.endDate >= value.startDate, {
    path: ['endDate'],
    message: 'The end date cannot be before the start date',
  })
export type DurationFormValues = z.infer<typeof durationFormSchema>

/** The Employee Position popup. */
export const positionFormSchema = z
  .object({
    code: z.string().trim().max(30, 'Keep it under 30 characters'),
    jobTitleId: z.string().min(1, 'Choose the position title'),
    divisionId: z.string(),
    branchId: z.string().min(1, 'Choose the station'),
    departmentId: z.string(),
    subDepartmentId: z.string(),
    employeeGroupId: z.string().min(1, 'Choose the employee group'),
    costCenterId: z.string(),
    gradeId: z.string(),
    reportsToId: z.string(),
    employeeId: z.string(),
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

/** A new salary range of an employee position, from a date on. */
export const salaryRangeFormSchema = z
  .object({
    effectiveDate: z.string().min(1, 'Select the date it applies from'),
    minSalary: amountText('Enter the minimum salary'),
    maxSalary: amountText('Enter the maximum salary', { positive: true }),
  })
  .superRefine((value, context) => {
    const min = toAmount(value.minSalary)
    const max = toAmount(value.maxSalary)
    if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
      context.addIssue({
        code: 'custom',
        path: ['minSalary'],
        message: 'The minimum salary cannot be above the maximum',
      })
    }
  })
export type SalaryRangeFormValues = z.infer<typeof salaryRangeFormSchema>

/** Add / Edit Budget (E-Budgeting). */
export const budgetFormSchema = z
  .object({
    title: z.string().trim().max(200, 'Keep it under 200 characters'),
    budgetDurationId: z.string().min(1, 'Choose the budget duration'),
    jobTitleId: z.string(),
    departmentId: z.string(),
    amount: amountText('Enter the budget amount', { positive: true }),
    totalPositions: amountText('Enter the total positions', { whole: true }),
    startDate: z.string().min(1, 'Select the start date'),
    endDate: z.string().min(1, 'Select the end date'),
  })
  .refine((value) => !value.startDate || !value.endDate || value.endDate >= value.startDate, {
    path: ['endDate'],
    message: 'The end date cannot be before the start date',
  })
  .refine((value) => value.title !== '' || value.jobTitleId !== '', {
    path: ['title'],
    message: 'Enter the title or choose the position title',
  })
export type BudgetFormValues = z.infer<typeof budgetFormSchema>

/** Edit Open Position. */
export const openPositionFormSchema = z.object({
  totalPositions: amountText('Enter the total positions', { positive: true, whole: true }),
  endDate: z.string(),
})
export type OpenPositionFormValues = z.infer<typeof openPositionFormSchema>
