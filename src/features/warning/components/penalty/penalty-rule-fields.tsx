import { useFormContext, useWatch } from 'react-hook-form'

import { SelectField, TextField } from '@/components/form'

import { useLeaveTypeOptions } from '../../hooks/use-warning-penalties'
import {
  DEDUCTION_OPTIONS,
  PENALTY_TIME_SPAN_OPTIONS,
  PENALTY_TYPE_OPTIONS,
} from '../../penalty-constants'
import type { PenaltyFormValues } from '../../schemas/penalty-form.schema'
import { BlockHeading } from '../block-heading'

interface PenaltyRuleFieldsProps {
  index: number
  heading?: string | undefined
  onRemove?: (() => void) | undefined
}

/**
 * One penalty block: the n-th warning of the policy within a week, month or year, what it costs
 * (half day, full day or a percentage of a day) and where it is taken from (payroll, a leave
 * balance, or both).
 */
export function PenaltyRuleFields({ index, heading, onRemove }: PenaltyRuleFieldsProps) {
  const { control } = useFormContext<PenaltyFormValues>()
  const [penaltyType, deduction, leaveTypeId] = useWatch({
    control,
    name: [`rules.${index}.penaltyType`, `rules.${index}.deduction`, `rules.${index}.leaveTypeId`],
  })
  const needsLeave = deduction !== 'payroll'
  const leaveTypes = useLeaveTypeOptions(needsLeave)
  const leaveOptions = (leaveTypes.data ?? []).map((type) => ({
    value: type.id,
    label: type.title,
  }))
  // A saved leave type the list cannot show (no access to leave types) still needs a label.
  if (leaveTypeId && !leaveOptions.some((option) => option.value === leaveTypeId)) {
    leaveOptions.push({ value: leaveTypeId, label: `Leave type #${leaveTypeId}` })
  }

  return (
    <div className="flex flex-col gap-6">
      <BlockHeading
        heading={heading}
        onRemove={onRemove}
        removeLabel={`Remove ${heading ?? 'penalty'}`}
      />

      <div className="grid gap-5 @md:grid-cols-2 @3xl:grid-cols-4">
        <TextField
          control={control}
          name={`rules.${index}.afterCount`}
          label="Count"
          description="The n-th warning in the time span (1–100)."
          inputMode="numeric"
          autoComplete="off"
        />
        <SelectField
          control={control}
          name={`rules.${index}.period`}
          label="Time Span"
          options={PENALTY_TIME_SPAN_OPTIONS}
        />
        <SelectField
          control={control}
          name={`rules.${index}.penaltyType`}
          label="Penalty Type"
          options={PENALTY_TYPE_OPTIONS}
        />
        {penaltyType === 'percentage' && (
          <TextField
            control={control}
            name={`rules.${index}.percentage`}
            label="Percentage of a day"
            inputMode="decimal"
            autoComplete="off"
            placeholder="e.g. 25"
          />
        )}
      </div>

      <div className="grid gap-5 @md:grid-cols-2 @3xl:grid-cols-4">
        <SelectField
          control={control}
          name={`rules.${index}.deduction`}
          label="Deduction"
          options={DEDUCTION_OPTIONS}
        />
        {needsLeave && (
          <SelectField
            control={control}
            name={`rules.${index}.leaveTypeId`}
            label="Leave Type"
            options={leaveOptions}
            placeholder={leaveTypes.isLoading ? 'Loading leave types…' : 'Select a leave type'}
          />
        )}
      </div>
    </div>
  )
}
