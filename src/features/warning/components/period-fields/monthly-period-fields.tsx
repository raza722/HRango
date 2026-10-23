import { useFormContext, useWatch } from 'react-hook-form'
import { endOfMonth, startOfMonth } from 'date-fns'

import { DatePickerField } from '@/components/form'
import { parseDateValue, toDateValue } from '@/lib/date'

import { TIME_SPAN_COPY } from '../../constants'
import type { PolicyFormValues } from '../../schemas/policy-form.schema'
import { getDayCount } from '../../utils/policy-mappers'
import {
  DaySelector,
  MonthSelector,
  type PeriodFieldsProps,
  PeriodHeading,
  RuleFields,
} from './shared'

const copy = TIME_SPAN_COPY.monthly

/**
 * Monthly block. The month chips and the date range stay in step: picking
 * "Apr" sets the range to 1–30 April, and picking a start date selects its month.
 */
export function MonthlyPeriodFields({ index, heading, onRemove }: PeriodFieldsProps) {
  const { control, getValues, setValue } = useFormContext<PolicyFormValues>()
  const [startDay, month] = useWatch({
    control,
    name: [`periods.${index}.startDay`, `periods.${index}.month`],
  })
  const start = parseDateValue(startDay)
  const options = { shouldDirty: true, shouldValidate: true } as const

  return (
    <div className="flex flex-col gap-6">
      <PeriodHeading heading={heading} onRemove={onRemove} />
      <div className="grid gap-5 @md:grid-cols-2">
        <DatePickerField
          control={control}
          name={`periods.${index}.startDay`}
          label={copy.startLabel}
          onValueChange={(value) => {
            const next = parseDateValue(value)
            if (!next) return
            setValue(`periods.${index}.endDay`, toDateValue(endOfMonth(next)), options)
            setValue(`periods.${index}.month`, next.getMonth(), { shouldDirty: true })
          }}
        />
        <DatePickerField
          control={control}
          name={`periods.${index}.endDay`}
          label={copy.endLabel}
          minDate={start}
          maxDate={start ? endOfMonth(start) : undefined}
        />
      </div>
      <MonthSelector
        index={index}
        timeSpan="monthly"
        onMonthChange={(nextMonth) => {
          const year = (
            parseDateValue(getValues(`periods.${index}.startDay`)) ?? new Date()
          ).getFullYear()
          const first = startOfMonth(new Date(year, nextMonth, 1))
          setValue(`periods.${index}.startDay`, toDateValue(first), options)
          setValue(`periods.${index}.endDay`, toDateValue(endOfMonth(first)), options)
        }}
      />
      <DaySelector index={index} dayCount={getDayCount('monthly', { startDay, month })} />
      <RuleFields index={index} timeSpan="monthly" />
    </div>
  )
}
