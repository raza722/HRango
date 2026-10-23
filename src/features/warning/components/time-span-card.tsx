import { useFormContext, useWatch } from 'react-hook-form'
import { CalendarDays, Plus } from 'lucide-react'

import { CalendarCheckIcon } from '@/components/icons/figma-icons'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { MAX_PERIODS, TIME_SPAN_COPY } from '../constants'
import type { PolicyFormValues } from '../schemas/policy-form.schema'
import { PeriodFields } from './period-fields'
import { warningType } from './type-styles'

interface TimeSpanCardProps {
  /** Field-array rows (from `useFieldArray`), keyed by `key`. */
  periods: readonly { key: string }[]
  onAddPeriod: () => void
  onRemovePeriod: (index: number) => void
  disabled?: boolean
}

/**
 * The second card. Its title, button and fields follow the Time Span select
 * ("Yearly" / "+ Add Year", "Monthly" / "+ Add Month", "Weekly" / "+ Add Week").
 */
export function TimeSpanCard({
  periods,
  onAddPeriod,
  onRemovePeriod,
  disabled,
}: TimeSpanCardProps) {
  const { control } = useFormContext<PolicyFormValues>()
  const timeSpan = useWatch({ control, name: 'timeSpan' })
  const copy = TIME_SPAN_COPY[timeSpan]
  const Icon = timeSpan === 'weekly' ? CalendarDays : CalendarCheckIcon
  const several = periods.length > 1

  return (
    <Card aria-labelledby="time-span-card-title">
      <CardHeader className="pt-6">
        <div className="flex items-center gap-4">
          <Icon className="size-9 text-chip" strokeWidth={1.5} aria-hidden="true" />
          <CardTitle id="time-span-card-title" className={warningType.cardTitle}>
            {copy.title}
          </CardTitle>
        </div>
        <Button
          variant="outline"
          onClick={onAddPeriod}
          disabled={disabled === true || periods.length >= MAX_PERIODS}
        >
          <Plus /> {copy.addLabel}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-8 pb-8 [&>*+*]:border-t [&>*+*]:pt-8">
        {periods.map((period, index) => (
          <PeriodFields
            key={period.key}
            index={index}
            timeSpan={timeSpan}
            heading={several ? `${copy.periodNoun} ${index + 1}` : undefined}
            onRemove={
              several
                ? () => {
                    onRemovePeriod(index)
                  }
                : undefined
            }
          />
        ))}
      </CardContent>
    </Card>
  )
}
