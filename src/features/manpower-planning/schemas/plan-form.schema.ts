import { z } from 'zod'

import type { BudgetDuration, PlanDetail, PlanInput } from '../types/manpower.types'
import { toAmount } from '../utils/plan-math'

const amountText = (message: string, { positive = false } = {}) =>
  z.string().superRefine((value, context) => {
    const number = toAmount(value)
    if (value.trim() === '' || !Number.isFinite(number)) {
      context.addIssue({ code: 'custom', message })
    } else if (number < 0 || (positive && number === 0)) {
      context.addIssue({ code: 'custom', message: positive ? message : 'Cannot be negative' })
    }
  })

const newLine = z.object({
  key: z.string(),
  positionId: z.string().min(1, 'Choose the position'),
  fromMonth: z.string().min(1, 'Choose the start month'),
  toMonth: z.string().min(1, 'Choose the end month'),
  divisionId: z.string(),
  stationId: z.string(),
  departmentId: z.string(),
  subDepartmentId: z.string(),
  employeeGroupId: z.string(),
  minSalary: amountText('Enter the min salary', { positive: true }),
  maxSalary: amountText('Enter the max salary', { positive: true }),
  totalAllowance: amountText('Enter the allowance'),
})

const existingLine = z.object({
  key: z.string(),
  employeeId: z.string().min(1, 'Choose the employee'),
  startDate: z.string().min(1, 'Choose the start date'),
  endDate: z.string().min(1, 'Choose the end date'),
  monthlySalary: amountText('Enter the monthly salary', { positive: true }),
  totalAllowance: amountText('Enter the allowance'),
})

const baseSchema = z.object({
  title: z.string().trim().min(1, 'Enter the title').max(80, 'Keep it under 80 characters'),
  durationId: z.string().min(1, 'Choose the plan year'),
  divisionId: z.string(),
  stationId: z.string(),
  departmentId: z.string(),
  subDepartmentId: z.string(),
  employeeGroupId: z.string(),
  description: z.string().max(1000, 'Keep it under 1000 characters'),
  newPositions: z.array(newLine),
  existingPositions: z.array(existingLine),
})

export type PlanFormValues = z.infer<typeof baseSchema>
export type NewLineValues = PlanFormValues['newPositions'][number]
export type ExistingLineValues = PlanFormValues['existingPositions'][number]

/**
 * Add Planning's rules. The plan year bounds every line, so the schema is made with
 * the budget durations: months and dates must fall within the chosen one.
 */
export function makePlanFormSchema(durations: readonly BudgetDuration[]) {
  return baseSchema.superRefine((values, context) => {
    if (values.newPositions.length + values.existingPositions.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['newPositions'],
        message: 'Add at least one new or existing position',
      })
    }
    const duration = durations.find((item) => item.id === values.durationId)
    const first = duration?.startDate.slice(0, 7)
    const last = duration?.endDate.slice(0, 7)
    values.newPositions.forEach((line, index) => {
      if (line.fromMonth && line.toMonth && line.toMonth < line.fromMonth) {
        context.addIssue({
          code: 'custom',
          path: ['newPositions', index, 'toMonth'],
          message: 'The end month cannot be before the start month',
        })
      } else if (duration && first && last) {
        if (line.fromMonth && line.fromMonth < first) {
          context.addIssue({
            code: 'custom',
            path: ['newPositions', index, 'fromMonth'],
            message: `Plan within ${duration.name}`,
          })
        }
        if (line.toMonth && line.toMonth > last) {
          context.addIssue({
            code: 'custom',
            path: ['newPositions', index, 'toMonth'],
            message: `Plan within ${duration.name}`,
          })
        }
      }
      const min = toAmount(line.minSalary)
      const max = toAmount(line.maxSalary)
      if (Number.isFinite(min) && Number.isFinite(max) && max < min) {
        context.addIssue({
          code: 'custom',
          path: ['newPositions', index, 'maxSalary'],
          message: 'Below the min salary',
        })
      }
    })
    const seen = new Set<string>()
    values.existingPositions.forEach((line, index) => {
      if (line.employeeId && seen.has(line.employeeId)) {
        context.addIssue({
          code: 'custom',
          path: ['existingPositions', index, 'employeeId'],
          message: 'Already in the plan',
        })
      }
      seen.add(line.employeeId)
      if (line.startDate && line.endDate && line.endDate < line.startDate) {
        context.addIssue({
          code: 'custom',
          path: ['existingPositions', index, 'endDate'],
          message: 'Before the start date',
        })
      } else if (duration) {
        if (line.startDate && line.startDate < duration.startDate) {
          context.addIssue({
            code: 'custom',
            path: ['existingPositions', index, 'startDate'],
            message: `Keep within ${duration.name}`,
          })
        }
        if (line.endDate && line.endDate > duration.endDate) {
          context.addIssue({
            code: 'custom',
            path: ['existingPositions', index, 'endDate'],
            message: `Keep within ${duration.name}`,
          })
        }
      }
    })
  })
}

export const EMPTY_PLAN: PlanFormValues = {
  title: '',
  durationId: '',
  divisionId: '',
  stationId: '',
  departmentId: '',
  subDepartmentId: '',
  employeeGroupId: '',
  description: '',
  newPositions: [],
  existingPositions: [],
}

const orNull = (value: string) => (value === '' ? null : value)
const orEmpty = (value: string | null) => value ?? ''

/** Form values → the API body (boxes to numbers, '' to null). */
export function toPlanInput(values: PlanFormValues): PlanInput {
  return {
    title: values.title.trim(),
    durationId: values.durationId,
    divisionId: orNull(values.divisionId),
    stationId: orNull(values.stationId),
    departmentId: orNull(values.departmentId),
    subDepartmentId: orNull(values.subDepartmentId),
    employeeGroupId: orNull(values.employeeGroupId),
    description: values.description.trim(),
    newPositions: values.newPositions.map((line) => ({
      id: line.key,
      positionId: line.positionId,
      fromMonth: line.fromMonth,
      toMonth: line.toMonth,
      divisionId: orNull(line.divisionId),
      stationId: orNull(line.stationId),
      departmentId: orNull(line.departmentId),
      subDepartmentId: orNull(line.subDepartmentId),
      employeeGroupId: orNull(line.employeeGroupId),
      minSalary: toAmount(line.minSalary),
      maxSalary: toAmount(line.maxSalary),
      totalAllowance: toAmount(line.totalAllowance),
    })),
    existingPositions: values.existingPositions.map((line) => ({
      id: line.key,
      employeeId: line.employeeId,
      startDate: line.startDate,
      endDate: line.endDate,
      monthlySalary: toAmount(line.monthlySalary),
      totalAllowance: toAmount(line.totalAllowance),
    })),
  }
}

/** A stored plan → form values. */
export function toPlanFormValues(plan: PlanDetail): PlanFormValues {
  return {
    title: plan.title,
    durationId: plan.durationId,
    divisionId: orEmpty(plan.divisionId),
    stationId: orEmpty(plan.stationId),
    departmentId: orEmpty(plan.departmentId),
    subDepartmentId: orEmpty(plan.subDepartmentId),
    employeeGroupId: orEmpty(plan.employeeGroupId),
    description: plan.description,
    newPositions: plan.newPositions.map((line) => ({
      key: line.id,
      positionId: line.positionId,
      fromMonth: line.fromMonth,
      toMonth: line.toMonth,
      divisionId: orEmpty(line.divisionId),
      stationId: orEmpty(line.stationId),
      departmentId: orEmpty(line.departmentId),
      subDepartmentId: orEmpty(line.subDepartmentId),
      employeeGroupId: orEmpty(line.employeeGroupId),
      minSalary: String(line.minSalary),
      maxSalary: String(line.maxSalary),
      totalAllowance: String(line.totalAllowance),
    })),
    existingPositions: plan.existingPositions.map((line) => ({
      key: line.id,
      employeeId: line.employeeId,
      startDate: line.startDate,
      endDate: line.endDate,
      monthlySalary: String(line.monthlySalary),
      totalAllowance: String(line.totalAllowance),
    })),
  }
}
