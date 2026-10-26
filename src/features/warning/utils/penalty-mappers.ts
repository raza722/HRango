import type { PenaltyFormRule, PenaltyFormValues } from '../schemas/penalty-form.schema'
import type {
  PenaltyPeriod,
  PenaltyRule,
  PenaltyRuleInput,
  WarningPenaltyInput,
} from '../types/warning-penalty.types'
import type { WarningPolicy } from '../types/warning-policy.types'

/** A fresh "+ Add Penalty" block. */
export function createEmptyRule(period: PenaltyPeriod = 'month', afterCount = 1): PenaltyFormRule {
  return {
    afterCount: String(afterCount),
    period,
    penaltyType: 'half_day',
    percentage: '',
    deduction: 'payroll',
    leaveTypeId: '',
  }
}

export function createDefaultPenaltyValues(policyId = ''): PenaltyFormValues {
  return { policyId, rules: [] }
}

/** A saved rule back as a form block. */
export function toPenaltyFormRule(rule: PenaltyRule): PenaltyFormRule {
  return {
    afterCount: String(rule.afterCount),
    period: rule.period,
    penaltyType: rule.penaltyType,
    percentage: rule.penaltyType === 'percentage' ? String(rule.percentage) : '',
    deduction: rule.deduction,
    leaveTypeId: rule.leaveTypeId ?? '',
  }
}

/** A policy's penalty rules as form values. */
export function toPenaltyFormValues(policy: WarningPolicy): PenaltyFormValues {
  return { policyId: policy.id, rules: policy.penalties.map(toPenaltyFormRule) }
}

function toRuleInput(rule: PenaltyFormRule): PenaltyRuleInput {
  return {
    afterCount: Number(rule.afterCount),
    period: rule.period,
    penaltyType: rule.penaltyType,
    percentage: rule.penaltyType === 'percentage' ? Number(rule.percentage) : null,
    deduction: rule.deduction,
    leaveTypeId: rule.deduction === 'payroll' || rule.leaveTypeId === '' ? null : rule.leaveTypeId,
  }
}

/** Form values -> `PenaltiesIn` (replaces every penalty rule of the policy). */
export function toPenaltyInput(values: PenaltyFormValues, rowVersion: string): WarningPenaltyInput {
  return { penalties: values.rules.map(toRuleInput), rowVersion }
}

/** A saved rule as it must be sent again (used when one rule is removed from the list). */
export function penaltyRuleToInput(rule: PenaltyRule): PenaltyRuleInput {
  return toRuleInput(toPenaltyFormRule(rule))
}
