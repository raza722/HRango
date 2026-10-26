import { useFormContext, useWatch } from 'react-hook-form'
import { Plus } from 'lucide-react'

import { SelectField, TextField } from '@/components/form'
import { CalendarCheckIcon } from '@/components/icons/figma-icons'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { CLOCK_EVENT_LABELS, TIME_SPAN_LABELS } from '../constants'
import type { PolicyFormValues } from '../schemas/policy-form.schema'
import { CLOCK_EVENTS_FOR, maxRulesFor } from '../types/warning-policy.types'
import { BlockHeading } from './block-heading'
import { warningType } from './type-styles'

interface PolicyRulesCardProps {
  /** Field-array rows (from `useFieldArray`), keyed by `key`. */
  rules: readonly { key: string }[]
  onAddRule: () => void
  onRemoveRule: (index: number) => void
  disabled?: boolean
}

/**
 * Second card: one rule per clock event. A day counts when it is off by more than Minutes;
 * every n-th counted day in the period raises a warning.
 */
export function PolicyRulesCard({
  rules,
  onAddRule,
  onRemoveRule,
  disabled,
}: PolicyRulesCardProps) {
  const { control, formState } = useFormContext<PolicyFormValues>()
  const [appliesTo, period] = useWatch({ control, name: ['appliesTo', 'period'] })
  const options = CLOCK_EVENTS_FOR[appliesTo].map((value) => ({
    value,
    label: CLOCK_EVENT_LABELS[value],
  }))
  const several = rules.length > 1
  const rulesError = formState.errors.rules?.root?.message ?? formState.errors.rules?.message

  return (
    <Card aria-labelledby="policy-rules-title">
      <CardHeader className="pt-6">
        <div className="flex items-center gap-4">
          <CalendarCheckIcon className="size-9 text-chip" strokeWidth={1.5} aria-hidden="true" />
          <CardTitle id="policy-rules-title" className={warningType.cardTitle}>
            {TIME_SPAN_LABELS[period]} rules
          </CardTitle>
        </div>
        <Button
          variant="outline"
          onClick={onAddRule}
          disabled={disabled === true || rules.length >= maxRulesFor(appliesTo)}
        >
          <Plus /> Add Rule
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-8 pb-8 [&>*+*]:border-t [&>*+*]:pt-8">
        {rulesError && (
          <p role="alert" className="text-sm text-destructive">
            {rulesError}
          </p>
        )}
        {rules.map((rule, index) => (
          <div key={rule.key} className="flex flex-col gap-6">
            <BlockHeading
              heading={several ? `Rule ${index + 1}` : undefined}
              removeLabel={`Remove rule ${index + 1}`}
              onRemove={
                several
                  ? () => {
                      onRemoveRule(index)
                    }
                  : undefined
              }
            />
            <div className="grid gap-5 @md:grid-cols-3">
              <SelectField
                control={control}
                name={`rules.${index}.clockEvent`}
                label="Clock Event"
                options={options}
              />
              <TextField
                control={control}
                name={`rules.${index}.minutes`}
                label="Minutes"
                description="Allowed per day before the day counts."
                inputMode="numeric"
                autoComplete="off"
              />
              <TextField
                control={control}
                name={`rules.${index}.occurrenceCount`}
                label="Warn Every (occurrences)"
                description="1 = every counted day raises a warning."
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
