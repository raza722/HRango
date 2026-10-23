import { useMemo } from 'react'
import { useController, useFormContext } from 'react-hook-form'
import { Trash2 } from 'lucide-react'

import { ChipCarousel, TextField, TimePickerField } from '@/components/form'
import { Button } from '@/components/ui/button'

import { MONTH_LABELS, TIME_SPAN_COPY } from '../../constants'
import type { PolicyFormValues } from '../../schemas/policy-form.schema'
import type { TimeSpan } from '../../types/warning-policy.types'
import { getDayCount } from '../../utils/policy-mappers'

const MONTH_ITEMS = MONTH_LABELS.map((label, value) => ({ value, label }))

export interface PeriodFieldsProps {
  index: number
  /** Shown as "Year 2" etc. when the policy has more than one block. */
  heading?: string | undefined
  onRemove?: (() => void) | undefined
}

export function PeriodHeading({
  heading,
  onRemove,
}: Pick<PeriodFieldsProps, 'heading' | 'onRemove'>) {
  if (!heading && !onRemove) return null
  return (
    <div className="flex items-center justify-between gap-3">
      {heading && <h3 className="text-base font-medium text-heading">{heading}</h3>}
      {onRemove && (
        <Button variant="ghost" size="sm" className="ml-auto text-destructive" onClick={onRemove}>
          <Trash2 /> Remove
        </Button>
      )}
    </div>
  )
}

/**
 * "Jan … Dec" carousel bound to `periods.N.month`. Keeps the selected day
 * valid for the new month (Day 31 becomes Day 30 when switching to April).
 */
export function MonthSelector({
  index,
  timeSpan,
  onMonthChange,
}: {
  index: number
  timeSpan: TimeSpan
  onMonthChange?: (month: number) => void
}) {
  const { control, getValues, setValue } = useFormContext<PolicyFormValues>()
  const { field } = useController({ control, name: `periods.${index}.month` })

  return (
    <ChipCarousel
      label="Month"
      items={MONTH_ITEMS}
      value={field.value}
      onChange={(month) => {
        field.onChange(month)
        const dayCount = getDayCount(timeSpan, {
          startDay: getValues(`periods.${index}.startDay`),
          month,
        })
        if (getValues(`periods.${index}.day`) > dayCount) {
          setValue(`periods.${index}.day`, dayCount, { shouldDirty: true })
        }
        onMonthChange?.(month)
      }}
    />
  )
}

/** "Day 1 … Day N" carousel bound to `periods.N.day`. */
export function DaySelector({ index, dayCount }: { index: number; dayCount: number }) {
  const { control } = useFormContext<PolicyFormValues>()
  const { field } = useController({ control, name: `periods.${index}.day` })
  const items = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => ({ value: i + 1, label: `Day ${i + 1}` })),
    [dayCount],
  )

  return (
    <ChipCarousel
      label="Day"
      items={items}
      value={Math.min(field.value, dayCount)}
      onChange={field.onChange}
    />
  )
}

/** The row of four inputs at the bottom of every period block. */
export function RuleFields({ index, timeSpan }: { index: number; timeSpan: TimeSpan }) {
  const { control } = useFormContext<PolicyFormValues>()
  const copy = TIME_SPAN_COPY[timeSpan]

  return (
    // Four across only when the card is wide enough for 150px+ time pickers.
    <div className="grid gap-5 @md:grid-cols-2 @3xl:grid-cols-4">
      <TextField
        control={control}
        name={`periods.${index}.totalGraceMinutes`}
        label="Total Grace Minutes"
        inputMode="numeric"
        autoComplete="off"
      />
      <TimePickerField
        control={control}
        name={`periods.${index}.clockIn`}
        label={copy.clockInLabel}
      />
      <TimePickerField
        control={control}
        name={`periods.${index}.clockOut`}
        label={copy.clockOutLabel}
      />
      <TextField
        control={control}
        name={`periods.${index}.minutes`}
        label="Minutes"
        inputMode="numeric"
        autoComplete="off"
      />
    </div>
  )
}
