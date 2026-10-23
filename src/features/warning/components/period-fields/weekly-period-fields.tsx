import { useFormContext } from 'react-hook-form'

import { SelectField, WeekdayToggleField } from '@/components/form'

import { TIME_SPAN_COPY, WEEKDAY_OPTIONS, WEEKDAY_SELECT_OPTIONS } from '../../constants'
import type { PolicyFormValues } from '../../schemas/policy-form.schema'
import { DaySelector, type PeriodFieldsProps, PeriodHeading, RuleFields } from './shared'

const copy = TIME_SPAN_COPY.weekly

/**
 * Weekly block: the weekday the week starts and ends on, the day of the cycle,
 * the working days the rule covers, and the grace rule.
 */
export function WeeklyPeriodFields({ index, heading, onRemove }: PeriodFieldsProps) {
  const { control } = useFormContext<PolicyFormValues>()

  return (
    <div className="flex flex-col gap-6">
      <PeriodHeading heading={heading} onRemove={onRemove} />
      <div className="grid gap-5 @md:grid-cols-2">
        <SelectField
          control={control}
          name={`periods.${index}.startDay`}
          label={copy.startLabel}
          options={WEEKDAY_SELECT_OPTIONS}
          placeholder="Select day"
        />
        <SelectField
          control={control}
          name={`periods.${index}.endDay`}
          label={copy.endLabel}
          options={WEEKDAY_SELECT_OPTIONS}
          placeholder="Select day"
        />
      </div>
      <DaySelector index={index} dayCount={7} />
      <WeekdayToggleField
        control={control}
        name={`periods.${index}.weekdays`}
        options={WEEKDAY_OPTIONS}
        label="Days the rule applies to"
      />
      <RuleFields index={index} timeSpan="weekly" />
    </div>
  )
}
