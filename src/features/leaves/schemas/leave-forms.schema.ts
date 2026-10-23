import { z } from 'zod'

import {
  ATTACHMENT_RULES,
  BALANCE_BASES,
  LEAVE_GENDER_RULES,
  LEAVE_MARITAL_RULES,
  LEAVE_TENURES,
  type LeavePolicy,
  type LeavePolicyInput,
  type LeaveType,
  type LeaveTypeInput,
  POLICY_KINDS,
  POLICY_LEVELS,
  type PolicyKind,
  SHORT_SLAB_UNITS,
} from '../types/leaves.types'

/*
 * The "Add Leave Types" and "Add Policy" forms keep their numbers as text
 * (an empty box is "not given"); the mappers turn them into the API's input.
 */

/** A whole number box: empty, or digits up to `max`. */
const wholeText = (max: number, allowEmpty: boolean) =>
  z
    .string()
    .trim()
    .refine((value) => allowEmpty || value !== '', 'Enter a number')
    .refine(
      (value) => value === '' || (/^\d+$/.test(value) && Number(value) <= max),
      `Enter a whole number up to ${String(max)}`,
    )

/** A days box: empty, or a number such as 0.5 up to `max`. */
const daysText = (max: number, allowEmpty: boolean) =>
  z
    .string()
    .trim()
    .refine((value) => allowEmpty || value !== '', 'Enter the number of days')
    .refine(
      (value) => value === '' || (/^\d+(\.\d{1,2})?$/.test(value) && Number(value) <= max),
      `Enter a number up to ${String(max)}`,
    )

const asNumber = (value: string) => (value === '' ? null : Number(value))

export const leaveTypeFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Enter the title').max(60, 'Keep it under 60 characters'),
    shortCode: z
      .string()
      .trim()
      .min(1, 'Enter the short code')
      .max(10, 'Keep it under 10 characters'),
    leavesAllowed: daysText(365, false),
    probationType: z.boolean(),
    active: z.boolean(),
    autoAllotment: z.boolean(),
    autoBalanceOnJoiningMonth: z.boolean(),
    composite: z.boolean(),
    shortLeave: z.boolean(),
    showInPayslip: z.boolean(),
    deductible: z.boolean(),
    sandwich: z.boolean(),
    sandwichAcrossTypes: z.boolean(),
    earnedBalance: z.boolean(),
    backDate: z.boolean(),
    backDateLimitDays: wholeText(365, true),
    futureDateLimit: z.boolean(),
    attachmentRequired: z.boolean(),
    attachmentRule: z.enum(ATTACHMENT_RULES).or(z.literal('')),
    encashment: z.boolean(),
    encashmentMin: daysText(365, true),
    encashmentMax: daysText(365, true),
    carryForward: z.boolean(),
    proRated: z.boolean(),
    gender: z.enum(LEAVE_GENDER_RULES),
    maritalStatus: z.enum(LEAVE_MARITAL_RULES),
    applyInProbation: z.boolean(),
    minExperienceMonths: wholeText(600, true),
    maxApplications: wholeText(999, true),
    gapMonths: wholeText(120, true),
    tenure: z.enum(LEAVE_TENURES),
    balanceBasis: z.enum(BALANCE_BASES),
    accumulativeCount: wholeText(99, true),
    experienceSlabs: z.array(
      z.object({
        minMonths: wholeText(600, false),
        maxMonths: wholeText(600, false),
        balance: daysText(365, false),
      }),
    ),
    shortLeaveSlabs: z.array(
      z.object({
        name: z.string().trim().min(1, 'Enter the name').max(40, 'Keep it under 40 characters'),
        balance: daysText(1, false),
        unit: z.enum(SHORT_SLAB_UNITS),
        value: wholeText(1440, false),
      }),
    ),
  })
  .superRefine((values, context) => {
    const need = (path: (string | number)[], message: string) => {
      context.addIssue({ code: 'custom', path, message })
    }
    if (values.attachmentRequired && values.attachmentRule === '') {
      need(['attachmentRule'], 'Choose what to do')
    }
    if (values.encashment) {
      const min = asNumber(values.encashmentMin)
      const max = asNumber(values.encashmentMax)
      if (min !== null && max !== null && min > max) {
        need(['encashmentMax'], 'Enter at least the Min Limit')
      }
    }
    if (values.balanceBasis === 'experience') {
      if (values.experienceSlabs.length === 0) need(['experienceSlabs'], 'Add at least one slab')
      values.experienceSlabs.forEach((slab, index) => {
        const min = asNumber(slab.minMonths)
        const max = asNumber(slab.maxMonths)
        if (min !== null && max !== null && max < min) {
          need(['experienceSlabs', index, 'maxMonths'], 'At least the Minimum Months')
        }
      })
    }
  })
export type LeaveTypeFormValues = z.infer<typeof leaveTypeFormSchema>

export const EMPTY_LEAVE_TYPE: LeaveTypeFormValues = {
  title: '',
  shortCode: '',
  leavesAllowed: '',
  probationType: false,
  active: true,
  autoAllotment: true,
  autoBalanceOnJoiningMonth: false,
  composite: false,
  shortLeave: false,
  showInPayslip: true,
  deductible: true,
  sandwich: false,
  sandwichAcrossTypes: false,
  earnedBalance: false,
  backDate: false,
  backDateLimitDays: '',
  futureDateLimit: false,
  attachmentRequired: false,
  attachmentRule: '',
  encashment: false,
  encashmentMin: '',
  encashmentMax: '',
  carryForward: false,
  proRated: false,
  gender: 'any',
  maritalStatus: 'any',
  applyInProbation: true,
  minExperienceMonths: '',
  maxApplications: '',
  gapMonths: '',
  tenure: 'yearly',
  balanceBasis: 'flat',
  accumulativeCount: '',
  experienceSlabs: [],
  shortLeaveSlabs: [],
}

const text = (value: number | null) => (value === null ? '' : String(value))

export function leaveTypeToForm(type: LeaveType): LeaveTypeFormValues {
  return {
    ...EMPTY_LEAVE_TYPE,
    title: type.title,
    shortCode: type.shortCode,
    leavesAllowed: String(type.leavesAllowed),
    probationType: type.probationType,
    active: type.active,
    autoAllotment: type.autoAllotment,
    autoBalanceOnJoiningMonth: type.autoBalanceOnJoiningMonth,
    composite: type.composite,
    shortLeave: type.shortLeave,
    showInPayslip: type.showInPayslip,
    deductible: type.deductible,
    sandwich: type.sandwich,
    sandwichAcrossTypes: type.sandwichAcrossTypes,
    earnedBalance: type.earnedBalance,
    backDate: type.backDate,
    backDateLimitDays: text(type.backDateLimitDays),
    futureDateLimit: type.futureDateLimit,
    attachmentRequired: type.attachmentRequired,
    attachmentRule: type.attachmentRule ?? '',
    encashment: type.encashment,
    encashmentMin: text(type.encashmentMin),
    encashmentMax: text(type.encashmentMax),
    carryForward: type.carryForward,
    proRated: type.proRated,
    gender: type.gender,
    maritalStatus: type.maritalStatus,
    applyInProbation: type.applyInProbation,
    minExperienceMonths: String(type.minExperienceMonths),
    maxApplications: text(type.maxApplications),
    gapMonths: text(type.gapMonths),
    tenure: type.tenure,
    balanceBasis: type.balanceBasis,
    accumulativeCount: text(type.accumulativeCount),
    experienceSlabs: type.experienceSlabs.map((slab) => ({
      minMonths: String(slab.minMonths),
      maxMonths: String(slab.maxMonths),
      balance: String(slab.balance),
    })),
    shortLeaveSlabs: type.shortLeaveSlabs.map((slab) => ({
      name: slab.name,
      balance: String(slab.balance),
      unit: slab.unit,
      value: String(slab.value),
    })),
  }
}

/** The list's inline switches (Status, Leave Encashment) send the whole type back. */
export function leaveTypeInput(type: LeaveType): LeaveTypeInput {
  const { id: _id, inUse: _inUse, createdAt: _createdAt, ...input } = type
  return input
}

export function leaveTypeToInput(values: LeaveTypeFormValues): LeaveTypeInput {
  return {
    title: values.title,
    shortCode: values.shortCode.toUpperCase(),
    leavesAllowed: Number(values.leavesAllowed),
    probationType: values.probationType,
    active: values.active,
    autoAllotment: values.autoAllotment,
    autoBalanceOnJoiningMonth: values.autoBalanceOnJoiningMonth,
    composite: values.composite,
    shortLeave: values.shortLeave,
    showInPayslip: values.showInPayslip,
    deductible: values.deductible,
    sandwich: values.sandwich,
    sandwichAcrossTypes: values.sandwichAcrossTypes,
    earnedBalance: values.earnedBalance,
    backDate: values.backDate,
    backDateLimitDays: values.backDate ? asNumber(values.backDateLimitDays) : null,
    futureDateLimit: values.futureDateLimit,
    attachmentRequired: values.attachmentRequired,
    attachmentRule:
      values.attachmentRequired && values.attachmentRule !== '' ? values.attachmentRule : null,
    encashment: values.encashment,
    encashmentMin: values.encashment ? asNumber(values.encashmentMin) : null,
    encashmentMax: values.encashment ? asNumber(values.encashmentMax) : null,
    carryForward: values.carryForward,
    proRated: values.proRated,
    gender: values.gender,
    maritalStatus: values.maritalStatus,
    applyInProbation: values.applyInProbation,
    minExperienceMonths: asNumber(values.minExperienceMonths) ?? 0,
    maxApplications: asNumber(values.maxApplications),
    gapMonths: asNumber(values.gapMonths),
    tenure: values.tenure,
    balanceBasis: values.balanceBasis,
    accumulativeCount: asNumber(values.accumulativeCount),
    experienceSlabs:
      values.balanceBasis === 'experience'
        ? values.experienceSlabs.map((slab) => ({
            minMonths: Number(slab.minMonths),
            maxMonths: Number(slab.maxMonths),
            balance: Number(slab.balance),
          }))
        : [],
    shortLeaveSlabs: values.shortLeave
      ? values.shortLeaveSlabs.map((slab) => ({
          name: slab.name,
          balance: Number(slab.balance),
          unit: slab.unit,
          value: Number(slab.value),
        }))
      : [],
  }
}

// --- Leave Policies -------------------------------------------------------------------------------

/** "Add Policy" (frame 4428:90498): Policy *, Title *, the level, Allow half day / short day leave. */
const isPolicyKind = (value: string): value is PolicyKind =>
  (POLICY_KINDS as readonly string[]).includes(value)

export const leavePolicyFormSchema = z.object({
  // The return type stays plain `boolean`, so the form keeps '' as "not chosen yet".
  kind: z.string().refine((value): boolean => isPolicyKind(value), 'Choose the policy'),
  title: z.string().trim().min(1, 'Enter the title').max(80, 'Keep it under 80 characters'),
  level: z.enum(POLICY_LEVELS),
  allowHalfDay: z.boolean(),
  allowShortLeave: z.boolean(),
})
export type LeavePolicyFormValues = z.infer<typeof leavePolicyFormSchema>

export function leavePolicyToForm(policy: LeavePolicy | null): LeavePolicyFormValues {
  return {
    kind: policy?.kind ?? '',
    title: policy?.title ?? '',
    level: policy?.level ?? 'company',
    allowHalfDay: policy?.allowHalfDay ?? true,
    allowShortLeave: policy?.allowShortLeave ?? false,
  }
}

/** The list's switches (Leave Policy, Status) keep their values; a new policy starts on. */
export function leavePolicyToInput(
  values: LeavePolicyFormValues,
  current: LeavePolicy | null,
): LeavePolicyInput {
  return {
    title: values.title,
    kind: isPolicyKind(values.kind) ? values.kind : 'distribution',
    level: values.level,
    allowHalfDay: values.allowHalfDay,
    allowShortLeave: values.allowShortLeave,
    enforced: current?.enforced ?? true,
    active: current?.active ?? true,
  }
}

/** The list's inline switches send the whole policy back. */
export function leavePolicyInput(policy: LeavePolicy): LeavePolicyInput {
  return {
    title: policy.title,
    kind: policy.kind,
    level: policy.level,
    allowHalfDay: policy.allowHalfDay,
    allowShortLeave: policy.allowShortLeave,
    enforced: policy.enforced,
    active: policy.active,
  }
}
