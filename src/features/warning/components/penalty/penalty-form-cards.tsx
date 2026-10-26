import { useFormContext } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'

import { SelectField } from '@/components/form'
import { GavelIcon } from '@/components/icons/figma-icons'
import { CollapsibleCard } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

import { allWarningPoliciesQueryOptions } from '../../api/warning-policy.queries'
import { POLICY_NAME_LABELS, TIME_SPAN_TABLE_LABELS } from '../../constants'
import { MAX_PENALTY_RULES } from '../../penalty-constants'
import type { PenaltyFormValues } from '../../schemas/penalty-form.schema'
import type { WarningPolicy } from '../../types/warning-policy.types'
import { warningType } from '../type-styles'
import { PenaltyRuleFields } from './penalty-rule-fields'

interface PenaltyDetailsCardProps {
  /** A policy was picked: load its penalties. */
  onPolicyChange: (policyId: string) => void
  policy?: WarningPolicy | undefined
  isLoading?: boolean
}

/** First card: the warning policy whose penalties are edited, and what it watches. */
export function PenaltyDetailsCard({
  onPolicyChange,
  policy,
  isLoading = false,
}: PenaltyDetailsCardProps) {
  const { control } = useFormContext<PenaltyFormValues>()
  const policies = useQuery(allWarningPoliciesQueryOptions())
  const options = (policies.data?.data ?? []).map((item) => ({
    value: item.id,
    label: `${item.title} · ${POLICY_NAME_LABELS[item.appliesTo]}`,
  }))

  return (
    <Card aria-label="Penalty policy details">
      <CardContent className="flex flex-col gap-5 pt-5 pb-8">
        <p className="min-h-5 text-sm text-muted-foreground" aria-live="polite">
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading penalties…
            </span>
          ) : policy ? (
            <>
              Penalties of <span className="font-medium text-heading">“{policy.title}”</span> (
              {POLICY_NAME_LABELS[policy.appliesTo]}, {TIME_SPAN_TABLE_LABELS[policy.period]})
            </>
          ) : (
            'Pick the warning policy whose penalties you want to set.'
          )}
        </p>

        <fieldset disabled={isLoading} className="grid min-w-0 gap-x-5 gap-y-5 @lg:grid-cols-2">
          <legend className="sr-only">Policy</legend>
          <SelectField
            control={control}
            name="policyId"
            label="Warning Policy"
            options={options}
            placeholder={policies.isPending ? 'Loading policies…' : 'Select a policy'}
            onValueChange={onPolicyChange}
          />
        </fieldset>
      </CardContent>
    </Card>
  )
}

interface PenaltyRulesCardProps {
  rules: readonly { key: string }[]
  onAddRule: () => void
  onRemoveRule: (index: number) => void
  disabled?: boolean
}

/** Second card ("Penalty" with the gavel): one block per penalty rule of the policy. */
export function PenaltyRulesCard({
  rules,
  onAddRule,
  onRemoveRule,
  disabled,
}: PenaltyRulesCardProps) {
  const { formState } = useFormContext<PenaltyFormValues>()
  const rulesError = formState.errors.rules?.root?.message ?? formState.errors.rules?.message

  return (
    <CollapsibleCard
      title="Penalty"
      icon={<GavelIcon className="h-9 w-10 shrink-0 text-chip" />}
      actions={
        <Button
          variant="outline"
          onClick={onAddRule}
          disabled={disabled === true || rules.length >= MAX_PENALTY_RULES}
        >
          <Plus /> Add Penalty
        </Button>
      }
      className={warningType.cardTitleScope}
      contentClassName="flex flex-col gap-8 pb-8 [&>*+*]:border-t [&>*+*]:pt-8"
    >
      {rulesError && (
        <p role="alert" className="text-sm text-destructive">
          {rulesError}
        </p>
      )}
      {rules.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {disabled
            ? 'Pick a policy first.'
            : 'No penalties: warnings under this policy cost nothing. Use “Add Penalty” to add one.'}
        </p>
      )}
      {rules.map((rule, index) => (
        <PenaltyRuleFields
          key={rule.key}
          index={index}
          heading={`Penalty ${index + 1}`}
          onRemove={() => {
            onRemoveRule(index)
          }}
        />
      ))}
    </CollapsibleCard>
  )
}
