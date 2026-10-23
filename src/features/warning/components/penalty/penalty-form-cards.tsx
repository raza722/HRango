import { useFormContext } from 'react-hook-form'
import { Loader2, Plus } from 'lucide-react'

import { SelectField, TextField } from '@/components/form'
import { GavelIcon } from '@/components/icons/figma-icons'
import { CollapsibleCard } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

import { POLICY_NAME_OPTIONS } from '../../constants'
import { MAX_PENALTY_RULES, SCALE_TYPE_OPTIONS } from '../../penalty-constants'
import type { PenaltyFormValues } from '../../schemas/penalty-form.schema'
import { warningType } from '../type-styles'
import { PenaltyRuleFields } from './penalty-rule-fields'

interface PenaltyDetailsCardProps {
  onAddPolicy: () => void
  editingTitle?: string | undefined
  isLoading?: boolean
}

/** First card: Policy Name, Title of Warning Policy, Type Of Scale. */
export function PenaltyDetailsCard({
  onAddPolicy,
  editingTitle,
  isLoading = false,
}: PenaltyDetailsCardProps) {
  const { control } = useFormContext<PenaltyFormValues>()

  return (
    <Card aria-label="Penalty policy details">
      <CardContent className="flex flex-col gap-5 pt-5 pb-8">
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading penalty…
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
          disabled={isLoading}
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
            placeholder="e.g. Late arrival penalty"
            autoComplete="off"
            maxLength={60}
          />
          <SelectField
            control={control}
            name="scaleType"
            label="Type Of Scale"
            options={SCALE_TYPE_OPTIONS}
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

/** Second card ("Penalty" with the gavel): one block per penalty rule. */
export function PenaltyRulesCard({
  rules,
  onAddRule,
  onRemoveRule,
  disabled,
}: PenaltyRulesCardProps) {
  const several = rules.length > 1

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
      {rules.map((rule, index) => (
        <PenaltyRuleFields
          key={rule.key}
          index={index}
          heading={several ? `Penalty ${index + 1}` : undefined}
          onRemove={
            several
              ? () => {
                  onRemoveRule(index)
                }
              : undefined
          }
        />
      ))}
    </CollapsibleCard>
  )
}
