import type { SyntheticEvent } from 'react'

import { cn } from '@/lib/utils'

import { useBenefitsLookups, useSavePlanYear } from '../../hooks/use-benefits'
import {
  PLAN_YEAR_STEPS,
  type PlanYearStep,
  planYearValues,
  usePlanYearWizard,
} from '../../hooks/use-plan-year-wizard'
import type { PlanYear } from '../../types/benefits.types'
import { accent, buttonClass } from '../shared/benefit-styles'
import { BxDialog } from '../shared/dialogs'
import { LookupsGate } from '../shared/list-parts'
import { StepBand, StepTabs } from '../shared/tabs'
import {
  DetailsStep,
  NewHiresStep,
  PlansStep,
  PlanYearStepHint,
  SelectAllPlans,
} from './plan-year-steps'

const TITLES: Record<PlanYearStep, string> = {
  details: 'Edit Plan Year',
  plans: 'Plans',
  'new-hires': 'New Hires',
}

const NEXT_LABEL: Record<PlanYearStep, string> = {
  details: 'Continue: Plans',
  plans: 'Continue: New Hires',
  'new-hires': 'Apply Changes',
}

const DESCRIPTIONS: Record<PlanYearStep, string> = {
  details: 'The plan year’s name and dates.',
  plans: 'Which plans will be offered to employees this year?',
  'new-hires': 'When new hires can start their benefits enrollment and how long they have.',
}

/**
 * Edit Plan Year, a popup over the list in three steps: Details → Continue: Plans; Plans →
 * Continue: New Hires; New Hires → Apply Changes. Row menu → New Hire opens it at New Hires.
 */
export function EditPlanYearDialog({
  year,
  startStep = 'details',
  onClose,
}: {
  year: PlanYear
  startStep?: PlanYearStep
  onClose: () => void
}) {
  const lookups = useBenefitsLookups()
  const save = useSavePlanYear()
  const wizard = usePlanYearWizard({
    initial: planYearValues(year),
    startStep,
    save: async (input) => {
      await save.mutateAsync({ id: year.id, input: { ...input, rowVersion: year.rowVersion } })
      onClose()
    },
  })
  const { form, step } = wizard
  const plans = lookups.data?.plans ?? []
  const rootError = form.formState.errors.root?.message

  return (
    <BxDialog
      title={TITLES[step]}
      description={DESCRIPTIONS[step]}
      onClose={onClose}
      className="sm:min-h-[27.75rem]"
    >
      <form
        noValidate
        onSubmit={(event: SyntheticEvent) => {
          event.preventDefault()
          void wizard.advance()
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <StepTabs
          label="Edit Plan Year steps"
          steps={PLAN_YEAR_STEPS}
          current={step}
          done={wizard.done}
          onSelect={wizard.open}
          className="mt-[1.1rem] px-4 sm:px-[1.375rem]"
          trailing={step === 'plans' ? <SelectAllPlans form={form} plans={plans} /> : undefined}
        />
        <StepBand>
          <PlanYearStepHint step={step} form={form} place="dialog" />
        </StepBand>
        <div className="@container min-h-0 flex-1 overflow-y-auto px-4 pt-6 pb-4 sm:px-[1.375rem] sm:pt-[1.1rem]">
          {step === 'details' && (
            <div className="pt-2 sm:px-2 sm:pt-[1.3rem]">
              <DetailsStep form={form} place="dialog" />
            </div>
          )}
          {step === 'plans' && (
            <LookupsGate query={lookups}>
              <PlansStep form={form} plans={plans} />
            </LookupsGate>
          )}
          {step === 'new-hires' && (
            <div className="sm:px-1">
              <NewHiresStep form={form} />
            </div>
          )}
          {rootError && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {rootError}
            </p>
          )}
        </div>
        <div className="flex justify-end px-4 pt-3 pb-5 sm:px-4 sm:pb-[1.1rem]">
          <button
            type="submit"
            disabled={save.isPending}
            className={cn(buttonClass, accent.bg, 'min-w-[11.5625rem]')}
          >
            {NEXT_LABEL[step]}
          </button>
        </div>
      </form>
    </BxDialog>
  )
}
