import { useFormContext, useWatch } from 'react-hook-form'
import { Loader2, Plus } from 'lucide-react'

import { SelectField, SwitchField, TextField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

import { POLICY_NAME_OPTIONS, TIME_SPAN_OPTIONS, WEEKDAY_SELECT_OPTIONS } from '../constants'
import type { PolicyFormValues } from '../schemas/policy-form.schema'
import { type AppliesTo, POLICY_NAMES } from '../types/warning-policy.types'

interface PolicyFormCardProps {
  /** Starts a new, empty policy; omitted when the user may not create one. */
  onAddPolicy?: (() => void) | undefined
  onAppliesToChange: (appliesTo: AppliesTo) => void
  /** Title of the policy being edited, if any. */
  editingTitle?: string | undefined
  isLoadingPolicy?: boolean
}

function isAppliesTo(value: string): value is AppliesTo {
  return POLICY_NAMES.some((name) => name === value)
}

/**
 * First card: Policy Name (what it watches), Title, Time Span (the period), Total Grace Minutes,
 * the week's start and end day for weekly policies, and Active.
 */
export function PolicyFormCard({
  onAddPolicy,
  onAppliesToChange,
  editingTitle,
  isLoadingPolicy = false,
}: PolicyFormCardProps) {
  const { control } = useFormContext<PolicyFormValues>()
  const period = useWatch({ control, name: 'period' })

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
          {onAddPolicy && (
            <Button variant="outline" onClick={onAddPolicy} className="ml-auto">
              <Plus /> Add Policy
            </Button>
          )}
        </div>

        <fieldset
          disabled={isLoadingPolicy}
          className="grid min-w-0 gap-x-5 gap-y-5 @lg:grid-cols-2 @lg:gap-y-6"
        >
          <legend className="sr-only">Policy</legend>
          <SelectField
            control={control}
            name="appliesTo"
            label="Policy Name"
            options={POLICY_NAME_OPTIONS}
            onValueChange={(value) => {
              if (isAppliesTo(value)) onAppliesToChange(value)
            }}
          />
          <TextField
            control={control}
            name="title"
            label="Title of Warning Policy"
            placeholder="e.g. Late arrival warning"
            autoComplete="off"
            maxLength={200}
          />
          <SelectField
            control={control}
            name="period"
            label="Time Span"
            options={TIME_SPAN_OPTIONS}
          />
          <TextField
            control={control}
            name="graceMinutes"
            label="Total Grace Minutes"
            description="Minutes allowed in each period before days start to count."
            inputMode="numeric"
            autoComplete="off"
            placeholder="None"
          />
          {period === 'week' && (
            <>
              <SelectField
                control={control}
                name="weekStartDay"
                label="Week Start Day"
                options={WEEKDAY_SELECT_OPTIONS}
                placeholder="Select day"
              />
              <SelectField
                control={control}
                name="weekEndDay"
                label="Week End Day"
                options={WEEKDAY_SELECT_OPTIONS}
                placeholder="Select day"
                clearable="Any day"
              />
            </>
          )}
          <SwitchField
            control={control}
            name="isActive"
            label="Status"
            stateLabel={(checked) => (checked ? 'Active' : 'Inactive')}
          />
        </fieldset>
      </CardContent>
    </Card>
  )
}
