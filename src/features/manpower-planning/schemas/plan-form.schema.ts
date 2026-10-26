import { z } from 'zod'

import type { BudgetDuration, PlanDetail, PlanInput, PlanLineInput } from '../types/manpower.types'
import { amountOrUndefined, monthEnd, monthStart, toAmount } from '../utils/plan-math'

/** An optional amount box: blank is allowed (the server fills it in). */
const optionalAmount = (message: string) =>
  z.string().superRefine((value, context) => {
    if (value.trim() === '') return
    const number = toAmount(value)
    if (!Number.isFinite(number)) context.addIssue({ code: 'custom', message })
    else if (number < 0) context.addIssue({ code: 'custom', message: 'Cannot be negative' })
  })

const newLine = z.object({
  key: z.string(),
  positionId: z.string().min(1, 'Choose the position'),
  headcount: z
    .string()
    .trim()
    .refine((value) => /^\d+$/.test(value) && Number(value) >= 1, 'At least 1'),
  /** `yyyy-MM`: the months the position is budgeted for (sent as their first and last days). */
  fromMonth: z.string().min(1, 'Choose the start month'),
  toMonth: z.string().min(1, 'Choose the end month'),
  /** Blank: the position's band in force. */
  minSalary: optionalAmount('Enter the min salary'),
  maxSalary: optionalAmount('Enter the max salary'),
  totalAllowance: optionalAmount('Enter the allowance'),
})

const existingLine = z.object({
  key: z.string(),
  employeeId: z.string().min(1, 'Choose the employee'),
  /** Shown only: the person as the picker or the saved plan named them. */
  employeeName: z.string(),
  jobTitleName: z.string(),
  departmentName: z.string(),
  branchName: z.string(),
  startDate: z.string().min(1, 'Choose the start date'),
  endDate: z.string().min(1, 'Choose the end date'),
  /** Blank: the person's current salary (Payroll). */
  monthlySalary: optionalAmount('Enter the monthly salary'),
  totalAllowance: optionalAmount('Enter the allowance'),
})

const fileRef = z.object({ id: z.string(), name: z.string(), url: z.string() })

const baseSchema = z.object({
  title: z.string().trim().min(1, 'Enter the title').max(200, 'Keep it under 200 characters'),
  budgetDurationId: z.string().min(1, 'Choose the plan year'),
  divisionId: z.string(),
  branchId: z.string(),
  departmentId: z.string(),
  subDepartmentId: z.string(),
  employeeGroupId: z.string(),
  description: z.string().max(4000, 'Keep it under 4000 characters'),
  files: z.array(fileRef).max(20, 'Attach up to 20 files'),
  newPositions: z.array(newLine),
  existingPositions: z.array(existingLine),
})

export type PlanFormValues = z.infer<typeof baseSchema>
export type NewLineValues = PlanFormValues['newPositions'][number]
export type ExistingLineValues = PlanFormValues['existingPositions'][number]
export type PlanFileValue = PlanFormValues['files'][number]

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
    const duration = durations.find((item) => item.id === values.budgetDurationId)
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
  budgetDurationId: '',
  divisionId: '',
  branchId: '',
  departmentId: '',
  subDepartmentId: '',
  employeeGroupId: '',
  description: '',
  files: [],
  newPositions: [],
  existingPositions: [],
}

const orNull = (value: string) => (value === '' ? null : value)
const amountText = (value: number | null) => (value === null ? '' : String(value))

/** Form values → the API body: new positions first, then existing employees. */
export function toPlanInput(values: PlanFormValues, rowVersion?: string): PlanInput {
  const lines: PlanLineInput[] = [
    ...values.newPositions.map((line): PlanLineInput => ({
      kind: 'new_position',
      positionId: line.positionId,
      headcount: Number(line.headcount),
      startDate: monthStart(line.fromMonth),
      endDate: monthEnd(line.toMonth),
      minSalary: amountOrUndefined(line.minSalary),
      maxSalary: amountOrUndefined(line.maxSalary),
      totalAllowance: amountOrUndefined(line.totalAllowance),
    })),
    ...values.existingPositions.map((line): PlanLineInput => ({
      kind: 'existing_employee',
      employeeId: line.employeeId,
      startDate: line.startDate,
      endDate: line.endDate,
      monthlySalary: amountOrUndefined(line.monthlySalary),
      totalAllowance: amountOrUndefined(line.totalAllowance),
    })),
  ]
  return {
    title: values.title.trim(),
    budgetDurationId: values.budgetDurationId,
    divisionId: orNull(values.divisionId),
    branchId: orNull(values.branchId),
    departmentId: orNull(values.departmentId),
    subDepartmentId: orNull(values.subDepartmentId),
    employeeGroupId: orNull(values.employeeGroupId),
    description: values.description.trim() || null,
    lines,
    fileIds: values.files.map((file) => file.id),
    ...(rowVersion ? { rowVersion } : {}),
  }
}

/** A stored plan → form values. */
export function toPlanFormValues(plan: PlanDetail): PlanFormValues {
  const ordered = [...plan.lines].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  return {
    title: plan.title,
    budgetDurationId: plan.budgetDurationId,
    divisionId: plan.divisionId ?? '',
    branchId: plan.branchId ?? '',
    departmentId: plan.departmentId ?? '',
    subDepartmentId: plan.subDepartmentId ?? '',
    employeeGroupId: plan.employeeGroupId ?? '',
    description: plan.description ?? '',
    files: plan.files.map((file) => ({ id: file.id, name: file.name, url: file.url })),
    newPositions: ordered
      .filter((line) => line.kind === 'new_position')
      .map((line) => ({
        key: line.id,
        positionId: line.positionId ?? '',
        headcount: String(line.headcount),
        fromMonth: line.startDate.slice(0, 7),
        toMonth: line.endDate.slice(0, 7),
        minSalary: amountText(line.minSalary),
        maxSalary: amountText(line.maxSalary),
        totalAllowance: String(line.totalAllowance),
      })),
    existingPositions: ordered
      .filter((line) => line.kind === 'existing_employee')
      .map((line) => ({
        key: line.id,
        employeeId: line.employeeId ?? '',
        employeeName: line.employeeName ?? '',
        jobTitleName: line.jobTitleName ?? '',
        departmentName: line.departmentName ?? '',
        branchName: line.branchName ?? '',
        startDate: line.startDate,
        endDate: line.endDate,
        monthlySalary: amountText(line.monthlySalary),
        totalAllowance: String(line.totalAllowance),
      })),
  }
}

const LINE_FIELDS: Record<string, { new: string; existing: string }> = {
  startDate: { new: 'fromMonth', existing: 'startDate' },
  endDate: { new: 'toMonth', existing: 'endDate' },
}

/**
 * Where a server field error lands on the form: `lines[2].startDate` is the third line sent,
 * new positions first; header fields keep their names.
 */
export function planErrorPath(path: string, newCount: number): string {
  const match = /^lines\[(\d+)\]\.(\w+)$/.exec(path)
  if (!match) return path === 'lines' ? 'newPositions' : path
  const index = Number(match[1])
  const field = match[2] ?? ''
  if (index < newCount) return `newPositions.${String(index)}.${LINE_FIELDS[field]?.new ?? field}`
  return `existingPositions.${String(index - newCount)}.${LINE_FIELDS[field]?.existing ?? field}`
}
