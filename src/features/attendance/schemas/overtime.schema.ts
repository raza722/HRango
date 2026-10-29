import { z } from 'zod'

import {
  OVERTIME_POLICY_PERIODS,
  type OvertimeDetailsIn,
  type OvertimePolicy,
  type OvertimePolicyInput,
  type OvertimeRequestBody,
  type OvertimeSettings,
} from '../types/overtime.types'
import {
  durationLabel,
  hoursToMinutes,
  minutesToHours,
  spanMinutes,
} from '../utils/overtime-format'
import { overlappingSlabs } from '../utils/overtime-policy'

const timeRule = {
  startTime: z.string().min(1, 'Enter the start time'),
  endTime: z.string().min(1, 'Enter the end time'),
  overtimeHours: z.string().trim().min(1, 'Enter the overtime hours'),
}

/** End after start, and the hours a number inside the span: shared by Apply and the bulk request. */
function checkTimes(
  values: { startTime: string; endTime: string; overtimeHours: string },
  context: z.RefinementCtx,
) {
  const need = (path: string, message: string) => {
    context.addIssue({ code: 'custom', path: [path], message })
  }
  const span =
    values.startTime && values.endTime ? spanMinutes(values.startTime, values.endTime) : 0
  if (values.startTime && values.endTime && span <= 0) need('endTime', 'End after the start time')
  if (values.overtimeHours) {
    const minutes = hoursToMinutes(values.overtimeHours)
    if (!/^\d+(\.\d+)?$/.test(values.overtimeHours) || Number.isNaN(minutes)) {
      need('overtimeHours', 'Enter hours as a number, e.g. 1.5')
    } else if (minutes <= 0) need('overtimeHours', 'More than 0 hours')
    else if (span > 0 && minutes > span) {
      need('overtimeHours', `At most ${durationLabel(span)}, the time between the two clocks`)
    }
  }
}

/** "Apply for Overtime": Department *, Location, Branch, Date *, Start / End Time *, Overtime Hours *, Reason, images. */
export const applyOvertimeSchema = z
  .object({
    departmentId: z.string().min(1, 'Choose the department'),
    locationId: z.string(),
    branchId: z.string(),
    date: z.string().min(1, 'Choose the date'),
    ...timeRule,
    reason: z.string().trim().max(4000, 'Keep it under 4000 characters'),
  })
  .superRefine(checkTimes)
export type ApplyOvertimeValues = z.infer<typeof applyOvertimeSchema>

export const APPLY_OVERTIME_DEFAULTS: ApplyOvertimeValues = {
  departmentId: '',
  locationId: '',
  branchId: '',
  date: '',
  startTime: '',
  endTime: '',
  overtimeHours: '',
  reason: '',
}

interface RequestFields {
  departmentId: string
  locationId: string
  branchId: string
  date: string
  startTime: string
  endTime: string
  overtimeHours: string
  reason: string
}

/** The form → `RequestIn[OvertimeDetails]`; `employeeId` files it on that person's behalf. */
export function toOvertimeBody(
  values: RequestFields,
  attachments: string[],
  employeeId?: string,
): OvertimeRequestBody {
  const details: OvertimeDetailsIn = {
    departmentId: values.departmentId,
    locationId: values.locationId || null,
    branchId: values.branchId || null,
    overtimeDate: values.date,
    startTime: values.startTime,
    endTime: values.endTime,
    appliedMinutes: hoursToMinutes(values.overtimeHours),
  }
  return {
    ...(employeeId ? { employeeId } : {}),
    fromDate: values.date,
    toDate: values.date,
    reason: values.reason.trim() || null,
    attachments,
    details,
  }
}

/**
 * "Create Bulk Overtime Request": Select Employees *, Department *, Location, Branch, Date *, the
 * times *, hours *, Reason *. One request is filed per person, on their behalf.
 */
export const bulkOvertimeSchema = z
  .object({
    employeeIds: z.array(z.string()).min(1, 'Choose at least one employee'),
    departmentId: z.string().min(1, 'Choose the department'),
    locationId: z.string(),
    branchId: z.string(),
    date: z.string().min(1, 'Choose the date'),
    ...timeRule,
    reason: z
      .string()
      .trim()
      .min(1, 'Give the reason for overtime')
      .max(4000, 'Keep it under 4000 characters'),
  })
  .superRefine(checkTimes)
export type BulkOvertimeValues = z.infer<typeof bulkOvertimeSchema>

export const BULK_OVERTIME_DEFAULTS: BulkOvertimeValues = {
  employeeIds: [],
  departmentId: '',
  locationId: '',
  branchId: '',
  date: '',
  startTime: '',
  endTime: '',
  overtimeHours: '',
  reason: '',
}

/** Whole minutes in a text box. */
const minutesText = (message: string) =>
  z
    .string()
    .trim()
    .min(1, message)
    .refine((value) => /^\d+$/.test(value), 'Whole minutes only')

/**
 * "Slab Create" / "Slab Edit": Full Day (the API's `full_day` encashment) or a leave type
 * (`leave` with its `leaveTypeId`), Minimum Minutes *, Maximum Minutes *.
 */
export const slabSchema = z
  .object({
    fullDay: z.boolean(),
    minMinutes: minutesText('Enter the minimum minutes'),
    maxMinutes: minutesText('Enter the maximum minutes'),
    leaveTypeId: z.string(),
    /** Kept for the slab table; the API sends it back. */
    leaveTypeName: z.string(),
  })
  .superRefine((values, context) => {
    if (!values.fullDay && !values.leaveTypeId) {
      context.addIssue({
        code: 'custom',
        path: ['leaveTypeId'],
        message: 'Choose the encashment type',
      })
    }
    if (!/^\d+$/.test(values.minMinutes) || !/^\d+$/.test(values.maxMinutes)) return
    if (Number(values.maxMinutes) <= Number(values.minMinutes)) {
      context.addIssue({
        code: 'custom',
        path: ['maxMinutes'],
        message: 'More than the minimum minutes',
      })
    }
    if (Number(values.maxMinutes) > 44_640) {
      context.addIssue({
        code: 'custom',
        path: ['maxMinutes'],
        message: 'At most 44,640 minutes (a month)',
      })
    }
  })
export type SlabValues = z.infer<typeof slabSchema>

export const SLAB_DEFAULTS: SlabValues = {
  fullDay: false,
  minMinutes: '',
  maxMinutes: '',
  leaveTypeId: '',
  leaveTypeName: '',
}

/** "Overtime Policy Create": Name, Type (period), Active, Description and the slabs (not overlapping). */
export const overtimePolicySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter the policy name')
      .max(200, 'Keep it under 200 characters'),
    period: z.enum(OVERTIME_POLICY_PERIODS),
    isActive: z.boolean(),
    description: z.string().trim().max(4000, 'Keep it under 4000 characters'),
    slabs: z.array(slabSchema).min(1, 'Create at least one slab').max(100, 'At most 100 slabs'),
  })
  .superRefine((values, context) => {
    const rows = values.slabs.map((slab) => ({
      minMinutes: Number(slab.minMinutes),
      maxMinutes: Number(slab.maxMinutes),
    }))
    const [overlap] = overlappingSlabs(rows)
    if (overlap) {
      const [a, b] = overlap
      context.addIssue({
        code: 'custom',
        path: ['slabs'],
        message: `Slabs ${String(a + 1)} and ${String(b + 1)} overlap: give each range its own minutes`,
      })
    }
    if (values.period === 'daily' && rows.some((row) => row.maxMinutes > 1440)) {
      context.addIssue({
        code: 'custom',
        path: ['slabs'],
        message: 'A daily slab ends at 1,440 minutes (a day) at most',
      })
    }
  })
export type OvertimePolicyValues = z.infer<typeof overtimePolicySchema>

export const POLICY_DEFAULTS: OvertimePolicyValues = {
  name: '',
  period: 'daily',
  isActive: true,
  description: '',
  slabs: [],
}

export function policyToValues(policy: OvertimePolicy): OvertimePolicyValues {
  return {
    name: policy.name,
    period: policy.period,
    isActive: policy.isActive,
    description: policy.description ?? '',
    slabs: policy.slabs.map((slab) => ({
      fullDay: slab.encashmentType === 'full_day',
      minMinutes: String(slab.minMinutes),
      maxMinutes: String(slab.maxMinutes),
      leaveTypeId: slab.leaveTypeId ?? '',
      leaveTypeName: slab.leaveTypeName ?? '',
    })),
  }
}

/** The form → `OvertimePolicyIn` (slabs are sent whole: the API replaces them). */
export function toPolicyInput(
  values: OvertimePolicyValues,
  rowVersion: string | null,
): OvertimePolicyInput {
  return {
    name: values.name.trim(),
    period: values.period,
    isActive: values.isActive,
    description: values.description.trim() || null,
    slabs: values.slabs.map((slab) => ({
      minMinutes: Number(slab.minMinutes),
      maxMinutes: Number(slab.maxMinutes),
      encashmentType: slab.fullDay ? 'full_day' : 'leave',
      leaveTypeId: slab.fullDay ? null : slab.leaveTypeId,
    })),
    rowVersion,
  }
}

/** Settings: the six switches and the encashment shift in hours (the API keeps minutes). */
export const overtimeSettingsSchema = z.object({
  overtimeOnCheckIn: z.boolean(),
  overtimeOnCheckOut: z.boolean(),
  overtimeApprovalRequired: z.boolean(),
  doNotAutoCreateRequests: z.boolean(),
  overtimeOnHolidays: z.boolean(),
  overtimeAfterDutyDuration: z.boolean(),
  encashmentShiftHours: z
    .string()
    .trim()
    .refine((value) => value === '' || /^\d+(\.\d+)?$/.test(value), 'Enter hours, e.g. 8')
    .refine((value) => value === '' || Number(value) <= 24, 'At most 24 hours')
    .refine(
      (value) =>
        value === '' || Math.abs(Number(value) * 60 - Math.round(Number(value) * 60)) < 1e-6,
      'Give the hours in whole minutes (e.g. 7.5)',
    ),
})
export type OvertimeSettingsValues = z.infer<typeof overtimeSettingsSchema>

export const toSettingsValues = (settings: OvertimeSettings): OvertimeSettingsValues => ({
  overtimeOnCheckIn: settings.overtimeOnCheckIn,
  overtimeOnCheckOut: settings.overtimeOnCheckOut,
  overtimeApprovalRequired: settings.overtimeApprovalRequired,
  doNotAutoCreateRequests: settings.doNotAutoCreateRequests,
  overtimeOnHolidays: settings.overtimeOnHolidays,
  overtimeAfterDutyDuration: settings.overtimeAfterDutyDuration,
  encashmentShiftHours: settings.encashmentShiftMinutes
    ? minutesToHours(settings.encashmentShiftMinutes)
    : '',
})

export const toOvertimeSettings = (
  values: OvertimeSettingsValues,
  rowVersion: string | null,
): OvertimeSettings => ({
  overtimeOnCheckIn: values.overtimeOnCheckIn,
  overtimeOnCheckOut: values.overtimeOnCheckOut,
  overtimeApprovalRequired: values.overtimeApprovalRequired,
  doNotAutoCreateRequests: values.doNotAutoCreateRequests,
  overtimeOnHolidays: values.overtimeOnHolidays,
  overtimeAfterDutyDuration: values.overtimeAfterDutyDuration,
  encashmentShiftMinutes:
    values.encashmentShiftHours === '' ? 0 : hoursToMinutes(values.encashmentShiftHours),
  rowVersion,
})
