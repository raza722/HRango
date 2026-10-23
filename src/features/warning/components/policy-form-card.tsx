import { useFormContext } from 'react-hook-form'
import { Loader2, Plus } from 'lucide-react'

import { SelectField, TextField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

import { CLOCK_EVENT_OPTIONS, POLICY_NAME_OPTIONS, TIME_SPAN_OPTIONS } from '../constants'
import type { PolicyFormValues } from '../schemas/policy-form.schema'
import { TIME_SPANS, type TimeSpan } from '../types/warning-policy.types'

interface PolicyFormCardProps {
  /** Starts a new, empty policy. */
  onAddPolicy: () => void
  onTimeSpanChange: (timeSpan: TimeSpan) => void
  /** Title of the policy being edited, if any. */
  editingTitle?: string | undefined
  isLoadingPolicy?: boolean
}

function isTimeSpan(value: string): value is TimeSpan {
  return TIME_SPANS.some((span) => span === value)
}

/** First card: Policy Name, Title of Warning Policy, Time Span, Clock In. */
export function PolicyFormCard({
  onAddPolicy,
  onTimeSpanChange,
  editingTitle,
  isLoadingPolicy = false,
}: PolicyFormCardProps) {
  const { control } = useFormContext<PolicyFormValues>()

  return (
    <Card aria-label="Policy details">
      <CardContent className="flex flex-col gap-5 pt-5 pb-8">
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {isLoadingPolicy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading policy…
              </span>
            ) : editingTitle ? (
              <>
                Editing <span className="font-medium text-heading">“{editingTitle}”</span>
              </>
            ) : null}
          </p>
          <Button variant="outline" onClick={onAddPolicy} className="ml-auto">
            <Plus /> Add Policy
          </Button>
        </div>

        <fieldset
          disabled={isLoadingPolicy}
          className="grid min-w-0 gap-x-5 gap-y-5 @lg:grid-cols-2 @lg:gap-y-6"
        >
          <legend className="sr-only">Policy</legend>
          <SelectField
            control={control}
            name="policyName"
            label="Policy Name"
            options={POLICY_NAME_OPTIONS}
          />
          <TextField
            control={control}
            name="title"
            label="Title of Warning Policy"
            placeholder="e.g. Late arrival warning"
            autoComplete="off"
            maxLength={60}
          />
          <SelectField
            control={control}
            name="timeSpan"
            label="Time Span"
            options={TIME_SPAN_OPTIONS}
            onValueChange={(value) => {
              if (isTimeSpan(value)) onTimeSpanChange(value)
            }}
          />
          <SelectField
            control={control}
            name="clockEvent"
            label="Clock In"
            options={CLOCK_EVENT_OPTIONS}
          />
        </fieldset>
      </CardContent>
    </Card>
  )
}
