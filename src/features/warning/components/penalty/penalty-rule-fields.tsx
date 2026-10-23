import { useMemo } from 'react'
import { useController, useFormContext, useWatch } from 'react-hook-form'

import {
  ChipCarousel,
  DatePickerField,
  SelectField,
  TextField,
  TimePickerField,
  WeekdayToggleField,
} from '@/components/form'
import { parseDateValue, toDateValue } from '@/lib/date'

import { TIME_SPAN_COPY, WEEKDAY_OPTIONS, WEEKDAY_SELECT_OPTIONS } from '../../constants'
import {
  BADGE_COLOR_OPTIONS,
  COUNT_OPTIONS,
  DEDUCTION_OPTIONS,
  PENALTY_TIME_SPAN_OPTIONS,
  PENALTY_TYPE_OPTIONS,
} from '../../penalty-constants'
import type { PenaltyFormValues } from '../../schemas/penalty-form.schema'
import { TIME_SPANS, type TimeSpan } from '../../types/warning-policy.types'
import { defaultRange, getRuleDayCount, rangeEndFor } from '../../utils/penalty-mappers'
import { PeriodHeading } from '../period-fields/shared'

function isTimeSpan(value: string): value is TimeSpan {
  return TIME_SPANS.some((span) => span === value)
}

interface PenaltyRuleFieldsProps {
  index: number
  heading?: string | undefined
  onRemove?: (() => void) | undefined
}

/**
 * One penalty block: when it triggers (count, span, range, day, weekdays,
 * time window) and what it costs (points, type, deduction, badge colour).
 */
export function PenaltyRuleFields({ index, heading, onRemove }: PenaltyRuleFieldsProps) {
  const { control, setValue, getValues } = useFormContext<PenaltyFormValues>()
  const [timeSpan, startDay, scaleType] = useWatch({
    control,
    name: [`rules.${index}.timeSpan`, `rules.${index}.startDay`, 'scaleType'],
  })
  const dayField = useController({ control, name: `rules.${index}.day` })
  const copy = TIME_SPAN_COPY[timeSpan]
  const weekly = timeSpan === 'weekly'
  const start = parseDateValue(startDay)
  const dayCount = getRuleDayCount({ timeSpan, startDay })
  const dayItems = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => ({ value: i + 1, label: `Day ${i + 1}` })),
    [dayCount],
  )
  const dirty = { shouldDirty: true, shouldValidate: true } as const

  return (
    <div className="flex flex-col gap-6">
      <PeriodHeading heading={heading} onRemove={onRemove} />

      <div className="grid gap-5 @md:grid-cols-2 @3xl:grid-cols-4">
        <SelectField
          control={control}
          name={`rules.${index}.count`}
          label="Count"
          options={COUNT_OPTIONS}
        />
        <SelectField
          control={control}
          name={`rules.${index}.timeSpan`}
          label="Time Span"
          options={PENALTY_TIME_SPAN_OPTIONS}
          onValueChange={(value) => {
            if (!isTimeSpan(value)) return
            // A new span means a new kind of range: reset it and the day picks.
            const range = defaultRange(value)
            setValue(`rules.${index}.startDay`, range.startDay, { shouldDirty: true })
            setValue(`rules.${index}.endDay`, range.endDay, { shouldDirty: true })
            setValue(`rules.${index}.day`, 1, { shouldDirty: true })
            setValue(
              `rules.${index}.weekdays`,
              value === 'weekly' ? ['mon', 'tue', 'wed', 'thu', 'fri'] : [],
              { shouldDirty: true },
            )
          }}
        />
        {weekly ? (
          <>
            <SelectField
              control={control}
              name={`rules.${index}.startDay`}
              label={copy.startLabel}
              options={WEEKDAY_SELECT_OPTIONS}
              placeholder="Select day"
            />
            <SelectField
              control={control}
              name={`rules.${index}.endDay`}
              label={copy.endLabel}
              options={WEEKDAY_SELECT_OPTIONS}
              placeholder="Select day"
            />
          </>
        ) : (
          <>
            <DatePickerField
              control={control}
              name={`rules.${index}.startDay`}
              label={copy.startLabel}
              onValueChange={(value) => {
                const next = parseDateValue(value)
                if (!next) return
                setValue(`rules.${index}.endDay`, toDateValue(rangeEndFor(timeSpan, next)), dirty)
                const days = getRuleDayCount({ timeSpan, startDay: value })
                if (getValues(`rules.${index}.day`) > days) setValue(`rules.${index}.day`, days)
              }}
            />
            <DatePickerField
              control={control}
              name={`rules.${index}.endDay`}
              label={copy.endLabel}
              minDate={start}
              maxDate={start ? rangeEndFor(timeSpan, start) : undefined}
            />
          </>
        )}
      </div>

      <ChipCarousel
        label="Day"
        items={dayItems}
        value={Math.min(dayField.field.value, dayCount)}
        onChange={dayField.field.onChange}
      />

      {weekly && (
        <WeekdayToggleField
          control={control}
          name={`rules.${index}.weekdays`}
          options={WEEKDAY_OPTIONS}
          label="Days the penalty watches"
        />
      )}

      <div className="grid gap-5 @md:grid-cols-2 @3xl:grid-cols-4">
        <TimePickerField control={control} name={`rules.${index}.from`} label="From" />
        <TimePickerField control={control} name={`rules.${index}.to`} label="To" />
        <TextField
          control={control}
          name={`rules.${index}.points`}
          label={scaleType === 'percentage' ? 'Points (%)' : 'Points'}
          inputMode="numeric"
          autoComplete="off"
          placeholder={scaleType === 'percentage' ? 'e.g. 50' : 'e.g. 5'}
        />
        <SelectField
          control={control}
          name={`rules.${index}.penaltyType`}
          label="Penalty Type"
          options={PENALTY_TYPE_OPTIONS}
        />
      </div>

      <div className="grid gap-5 @md:grid-cols-2 @3xl:grid-cols-4">
        <SelectField
          control={control}
          name={`rules.${index}.deduction`}
          label="Deduction"
          options={DEDUCTION_OPTIONS}
        />
        <SelectField
          control={control}
          name={`rules.${index}.badgeColor`}
          label="Badge Color"
          options={BADGE_COLOR_OPTIONS}
        />
      </div>
    </div>
  )
}
