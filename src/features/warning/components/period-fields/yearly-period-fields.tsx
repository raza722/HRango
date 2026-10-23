import { useFormContext, useWatch } from 'react-hook-form'
import { addYears, subDays } from 'date-fns'

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

const copy = TIME_SPAN_COPY.yearly

/** Last day of a year that starts on `start`. */
function yearEnd(start: Date): Date {
  return subDays(addYears(start, 1), 1)
}

/**
 * Yearly block: a date range of up to one year, the month and day the rule
 * takes effect, then the grace rule itself.
 */
export function YearlyPeriodFields({ index, heading, onRemove }: PeriodFieldsProps) {
  const { control, setValue } = useFormContext<PolicyFormValues>()
  const [startDay, month] = useWatch({
    control,
    name: [`periods.${index}.startDay`, `periods.${index}.month`],
  })
  const start = parseDateValue(startDay)

  return (
    <div className="flex flex-col gap-6">
      <PeriodHeading heading={heading} onRemove={onRemove} />
      <div className="grid gap-5 @md:grid-cols-2">
        <DatePickerField
          control={control}
          name={`periods.${index}.startDay`}
          label={copy.startLabel}
          onValueChange={(value) => {
            // A policy year runs for twelve months from its start day.
            const next = parseDateValue(value)
            if (next) {
              setValue(`periods.${index}.endDay`, toDateValue(yearEnd(next)), {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          }}
        />
        <DatePickerField
          control={control}
          name={`periods.${index}.endDay`}
          label={copy.endLabel}
          minDate={start}
          maxDate={start ? yearEnd(start) : undefined}
        />
      </div>
      <MonthSelector index={index} timeSpan="yearly" />
      <DaySelector index={index} dayCount={getDayCount('yearly', { startDay, month })} />
      <RuleFields index={index} timeSpan="yearly" />
    </div>
  )
}
