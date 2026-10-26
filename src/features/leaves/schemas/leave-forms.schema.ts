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
  SHORT_SLAB_VALUE_TYPES,
} from '../types/leaves.types'

/*
 * The "Add Leave Types" and "Add Policy" forms keep their numbers as text (an empty box is
 * "not given"); the mappers turn them into the API's input (`LeaveTypeIn`, `LeavePolicyIn`).
 * Limits follow backend/app/schemas/leaves.py.
 */

/** A whole number box: empty, or digits from `min` up to `max`. */
const wholeText = (max: number, allowEmpty: boolean, min = 0) =>
  z
    .string()
    .trim()
    .refine((value) => allowEmpty || value !== '', 'Enter a number')
    .refine(
      (value) =>
        value === '' || (/^\d+$/.test(value) && Number(value) <= max && Number(value) >= min),
      min > 0
        ? `Enter a whole number from ${String(min)} to ${String(max)}`
        : `Enter a whole number up to ${String(max)}`,
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
    title: z.string().trim().min(1, 'Enter the title').max(200, 'Keep it under 200 characters'),
    shortCode: z
      .string()
      .trim()
      .min(1, 'Enter the short code')
      .max(10, 'Keep it under 10 characters'),
    allowance: daysText(366, false),
    isProbationType: z.boolean(),
    isActive: z.boolean(),
    autoAllotment: z.boolean(),
    autoBalanceOnJoining: z.boolean(),
    isComposite: z.boolean(),
    isShortLeave: z.boolean(),
    showInPayslip: z.boolean(),
    isDeductible: z.boolean(),
    isSandwich: z.boolean(),
    sandwichAcrossTypes: z.boolean(),
    isEarned: z.boolean(),
    allowBackDate: z.boolean(),
    backDateLimitDays: wholeText(366, true),
    hasFutureLimit: z.boolean(),
    futureLimitDays: wholeText(366, true),
    attachmentRequired: z.boolean(),
    attachmentRule: z.enum(ATTACHMENT_RULES).or(z.literal('')),
    allowEncashment: z.boolean(),
    encashmentMin: daysText(366, true),
    encashmentMax: daysText(366, true),
    carryForward: z.boolean(),
    proRated: z.boolean(),
    gender: z.enum(LEAVE_GENDER_RULES),
    maritalStatus: z.enum(LEAVE_MARITAL_RULES),
    allowedInProbation: z.boolean(),
    minExperienceMonths: wholeText(600, true),
    maxApplications: wholeText(1000, true, 1),
    gapBetweenApplicationsMonths: wholeText(600, true),
    tenure: z.enum(LEAVE_TENURES),
    balanceBasis: z.enum(BALANCE_BASES),
    accumulativeCount: wholeText(50, true, 1),
    experienceSlabs: z
      .array(
        z.object({
          minMonths: wholeText(600, false),
          maxMonths: wholeText(600, true),
          balance: daysText(366, false),
        }),
      )
      .max(50, 'Up to 50 slabs'),
    shortSlabs: z
      .array(
        z.object({
          name: z.string().trim().min(1, 'Enter the name').max(200, 'Keep it under 200 characters'),
          balance: daysText(366, true),
          valueType: z.enum(SHORT_SLAB_VALUE_TYPES),
          value: z
            .string()
            .trim()
            .refine((value) => value === '' || /^\d+(\.\d{1,2})?$/.test(value), 'Enter a number'),
        }),
      )
      .max(20, 'Up to 20 slabs'),
  })
  .superRefine((values, context) => {
    const need = (path: (string | number)[], message: string) => {
      context.addIssue({ code: 'custom', path, message })
    }
    if (values.attachmentRequired && values.attachmentRule === '') {
      need(['attachmentRule'], 'Choose what to do')
    }
    if (values.allowEncashment) {
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
  allowance: '',
  isProbationType: false,
  isActive: true,
  autoAllotment: true,
  autoBalanceOnJoining: false,
  isComposite: false,
  isShortLeave: false,
  showInPayslip: true,
  isDeductible: true,
  isSandwich: false,
  sandwichAcrossTypes: false,
  isEarned: false,
  allowBackDate: false,
  backDateLimitDays: '',
  hasFutureLimit: false,
  futureLimitDays: '',
  attachmentRequired: false,
  attachmentRule: '',
  allowEncashment: false,
  encashmentMin: '',
  encashmentMax: '',
  carryForward: false,
  proRated: false,
  gender: 'any',
  maritalStatus: 'any',
  allowedInProbation: true,
  minExperienceMonths: '',
  maxApplications: '',
  gapBetweenApplicationsMonths: '',
  tenure: 'yearly',
  balanceBasis: 'flat',
  accumulativeCount: '',
  experienceSlabs: [],
  shortSlabs: [],
}

const text = (value: number | null) => (value === null ? '' : String(value))

/** The API's codes are checked against the form's lists, so an unknown one falls back. */
const oneOf = <T extends string>(list: readonly T[], value: string, fallback: T): T =>
  list.find((item) => item === value) ?? fallback

export function leaveTypeToForm(type: LeaveType): LeaveTypeFormValues {
  return {
    title: type.title,
    shortCode: type.shortCode,
    allowance: text(type.allowance),
    isProbationType: type.isProbationType,
    isActive: type.isActive,
    autoAllotment: type.autoAllotment,
    autoBalanceOnJoining: type.autoBalanceOnJoining,
    isComposite: type.isComposite,
    isShortLeave: type.isShortLeave,
    showInPayslip: type.showInPayslip,
    isDeductible: type.isDeductible,
    isSandwich: type.isSandwich,
    sandwichAcrossTypes: type.sandwichAcrossTypes,
    isEarned: type.isEarned,
    allowBackDate: type.allowBackDate,
    backDateLimitDays: text(type.backDateLimitDays),
    hasFutureLimit: type.hasFutureLimit,
    futureLimitDays: text(type.futureLimitDays),
    attachmentRequired: type.attachmentRequired,
    attachmentRule: type.attachmentRule ?? '',
    allowEncashment: type.allowEncashment,
    encashmentMin: text(type.encashmentMin),
    encashmentMax: text(type.encashmentMax),
    carryForward: type.carryForward,
    proRated: type.proRated,
    gender: oneOf(LEAVE_GENDER_RULES, type.gender, 'any'),
    maritalStatus: oneOf(LEAVE_MARITAL_RULES, type.maritalStatus, 'any'),
    allowedInProbation: type.allowedInProbation,
    minExperienceMonths: text(type.minExperienceMonths),
    maxApplications: text(type.maxApplications),
    gapBetweenApplicationsMonths: text(type.gapBetweenApplicationsMonths),
    tenure: oneOf(LEAVE_TENURES, type.tenure, 'yearly'),
    balanceBasis: oneOf(BALANCE_BASES, type.balanceBasis, 'flat'),
    accumulativeCount: text(type.accumulativeCount),
    experienceSlabs: type.experienceSlabs.map((slab) => ({
      minMonths: String(slab.minMonths),
      maxMonths: text(slab.maxMonths),
      balance: String(slab.balance),
    })),
    shortSlabs: type.shortSlabs.map((slab) => ({
      name: slab.name,
      balance: text(slab.balance),
      valueType: oneOf(SHORT_SLAB_VALUE_TYPES, slab.valueType, 'percentage'),
      value: text(slab.value),
    })),
  }
}

/** The list's inline switches (Status, Leave Encashment) send the whole type back. */
export function leaveTypeInput(type: LeaveType): LeaveTypeInput {
  const {
    id: _id,
    inUse: _inUse,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    allowance,
    ...rest
  } = type
  return { ...rest, allowance: allowance ?? 0 }
}

export function leaveTypeToInput(
  values: LeaveTypeFormValues,
  rowVersion: string | null,
): LeaveTypeInput {
  return {
    title: values.title,
    shortCode: values.shortCode.toUpperCase(),
    allowance: Number(values.allowance),
    isProbationType: values.isProbationType,
    isActive: values.isActive,
    autoAllotment: values.autoAllotment,
    autoBalanceOnJoining: values.autoBalanceOnJoining,
    isComposite: values.isComposite,
    isShortLeave: values.isShortLeave,
    showInPayslip: values.showInPayslip,
    isDeductible: values.isDeductible,
    isSandwich: values.isSandwich,
    sandwichAcrossTypes: values.sandwichAcrossTypes,
    isEarned: values.isEarned,
    allowBackDate: values.allowBackDate,
    backDateLimitDays: values.allowBackDate ? asNumber(values.backDateLimitDays) : null,
    hasFutureLimit: values.hasFutureLimit,
    futureLimitDays: values.hasFutureLimit ? asNumber(values.futureLimitDays) : null,
    attachmentRequired: values.attachmentRequired,
    attachmentRule:
      values.attachmentRequired && values.attachmentRule !== '' ? values.attachmentRule : null,
    allowEncashment: values.allowEncashment,
    encashmentMin: values.allowEncashment ? asNumber(values.encashmentMin) : null,
    encashmentMax: values.allowEncashment ? asNumber(values.encashmentMax) : null,
    carryForward: values.carryForward,
    proRated: values.proRated,
    gender: values.gender,
    maritalStatus: values.maritalStatus,
    allowedInProbation: values.allowedInProbation,
    minExperienceMonths: asNumber(values.minExperienceMonths),
    maxApplications: asNumber(values.maxApplications),
    gapBetweenApplicationsMonths: asNumber(values.gapBetweenApplicationsMonths),
    tenure: values.tenure,
    balanceBasis: values.balanceBasis,
    accumulativeCount: asNumber(values.accumulativeCount),
    experienceSlabs:
      values.balanceBasis === 'experience'
        ? values.experienceSlabs.map((slab) => ({
            minMonths: Number(slab.minMonths),
            maxMonths: asNumber(slab.maxMonths),
            balance: Number(slab.balance),
          }))
        : [],
    shortSlabs: values.isShortLeave
      ? values.shortSlabs.map((slab) => ({
          name: slab.name,
          balance: asNumber(slab.balance),
          valueType: slab.valueType,
          value: asNumber(slab.value),
        }))
      : [],
    rowVersion,
  }
}

// --- Leave Policies -------------------------------------------------------------------------------

const isPolicyKind = (value: string): value is PolicyKind =>
  (POLICY_KINDS as readonly string[]).includes(value)

/**
 * "Add Policy" (frame 4428:90498): Policy *, Title *, the level, Allow half day / short day
 * leave, and (a distribution policy) the leave types it gives with an allowance each.
 */
export const leavePolicyFormSchema = z
  .object({
    // The return type stays plain `boolean`, so the form keeps '' as "not chosen yet".
    policyKind: z.string().refine((value): boolean => isPolicyKind(value), 'Choose the policy'),
    title: z.string().trim().min(1, 'Enter the title').max(200, 'Keep it under 200 characters'),
    policyLevel: z.enum(POLICY_LEVELS),
    allowHalfDay: z.boolean(),
    allowShortLeave: z.boolean(),
    types: z
      .array(
        z.object({
          leaveTypeId: z.string().min(1, 'Choose the leave type'),
          allowance: daysText(366, true),
        }),
      )
      .max(100),
  })
  .superRefine((values, context) => {
    if (values.policyKind === 'distribution' && values.types.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['types'],
        message: 'Choose at least one leave type',
      })
    }
    const seen = new Set<string>()
    values.types.forEach((row, index) => {
      if (row.leaveTypeId && seen.has(row.leaveTypeId)) {
        context.addIssue({
          code: 'custom',
          path: ['types', index, 'leaveTypeId'],
          message: 'Listed already',
        })
      }
      seen.add(row.leaveTypeId)
    })
  })
export type LeavePolicyFormValues = z.infer<typeof leavePolicyFormSchema>

export function leavePolicyToForm(policy: LeavePolicy | null): LeavePolicyFormValues {
  return {
    policyKind: policy?.policyKind ?? '',
    title: policy?.title ?? '',
    policyLevel: policy?.policyLevel ?? 'company',
    allowHalfDay: policy?.allowHalfDay ?? true,
    allowShortLeave: policy?.allowShortLeave ?? false,
    types: (policy?.types ?? []).map((row) => ({
      leaveTypeId: row.leaveTypeId,
      allowance: text(row.allowance),
    })),
  }
}

/** The list's Status switch keeps its value; a new policy starts active. */
export function leavePolicyToInput(
  values: LeavePolicyFormValues,
  current: LeavePolicy | null,
): LeavePolicyInput {
  const kind = isPolicyKind(values.policyKind) ? values.policyKind : 'distribution'
  return {
    title: values.title,
    policyKind: kind,
    policyLevel: values.policyLevel,
    allowHalfDay: values.allowHalfDay,
    allowShortLeave: values.allowShortLeave,
    isActive: current?.isActive ?? true,
    types:
      kind === 'distribution'
        ? values.types.map((row) => ({
            leaveTypeId: row.leaveTypeId,
            allowance: asNumber(row.allowance),
          }))
        : [],
    rowVersion: current?.rowVersion ?? null,
  }
}

/** The list's inline switch sends the whole policy back. */
export function leavePolicyInput(policy: LeavePolicy): LeavePolicyInput {
  return {
    title: policy.title,
    policyKind: policy.policyKind,
    policyLevel: policy.policyLevel,
    allowHalfDay: policy.allowHalfDay,
    allowShortLeave: policy.allowShortLeave,
    isActive: policy.isActive,
    types: policy.types.map((row) => ({ leaveTypeId: row.leaveTypeId, allowance: row.allowance })),
    rowVersion: policy.rowVersion,
  }
}
