import type { SyntheticEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'

import { UnsavedChangesDialog } from '@/components/feedback/unsaved-changes-dialog'
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard'
import { cn } from '@/lib/utils'

import { useBenefitsLookups, useSavePlanYear } from '../../hooks/use-benefits'
import {
  EMPTY_PLAN_YEAR,
  PLAN_YEAR_STEPS,
  type PlanYearStep,
  usePlanYearWizard,
} from '../../hooks/use-plan-year-wizard'
import { accent, buttonClass } from '../shared/benefit-styles'
import { LookupsGate } from '../shared/list-parts'
import { BenefitsFormPage, BxCard } from '../shared/page-frame'
import { StepBand, StepTabs } from '../shared/tabs'
import {
  DetailsStep,
  NewHiresStep,
  PlansStep,
  PlanYearStepHint,
  SelectAllPlans,
} from './plan-year-steps'

const TITLES: Record<PlanYearStep, string> = {
  details: 'Plan Year Details',
  plans: 'Plans',
  'new-hires': 'New Hires',
}

const NEXT_LABEL: Record<PlanYearStep, string> = {
  details: 'Continue: Plans',
  plans: 'Continue: New Hires',
  'new-hires': 'Create Plan Year',
}

/**
 * New Plan Year: the whole card is the form, in the same three steps as Edit Plan Year
 * (Details, Plans, New Hires). Creating it goes back to the list.
 */
export function NewPlanYearPage() {
  const navigate = useNavigate()
  const lookups = useBenefitsLookups()
  const save = useSavePlanYear()
  const wizard = usePlanYearWizard({
    initial: EMPTY_PLAN_YEAR,
    save: async (input) => {
      await save.mutateAsync({ input })
      guard.allowNextNavigation()
      await navigate({ to: '/benefits/plan-years' })
    },
  })
  const { form, step } = wizard
  const guard = useUnsavedChangesGuard(form.formState.isDirty && !save.isSuccess)
  const plans = lookups.data?.plans ?? []
  const rootError = form.formState.errors.root?.message

  return (
    <BenefitsFormPage>
      <BxCard title={TITLES[step]}>
        <form
          noValidate
          onSubmit={(event: SyntheticEvent) => {
            event.preventDefault()
            void wizard.advance()
          }}
          className="flex flex-1 flex-col"
        >
          <StepTabs
            label="New Plan Year steps"
            steps={PLAN_YEAR_STEPS}
            current={step}
            done={wizard.done}
            onSelect={wizard.open}
            className="mt-[1.75rem] px-4 sm:px-6"
            trailing={step === 'plans' ? <SelectAllPlans form={form} plans={plans} /> : undefined}
          />
          <StepBand className="sm:px-7">
            <PlanYearStepHint step={step} form={form} place="page" />
          </StepBand>
          <div className="flex-1 px-4 pt-6 sm:px-6 sm:pt-[1.8rem]">
            {step === 'details' && (
              <div className="sm:px-[1.1rem]">
                <DetailsStep form={form} place="page" />
              </div>
            )}
            {step === 'plans' && (
              <div className="max-w-[46rem]">
                <LookupsGate query={lookups}>
                  <PlansStep form={form} plans={plans} />
                </LookupsGate>
              </div>
            )}
            {step === 'new-hires' && (
              <div className="sm:px-[1.1rem]">
                <NewHiresStep form={form} />
              </div>
            )}
            {rootError && (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {rootError}
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-3.5 px-4 pt-6 sm:px-[1.1875rem]">
            <button
              type="button"
              onClick={() => {
                void navigate({ to: '/benefits/plan-years' })
              }}
              className={cn(buttonClass, accent.outline, 'min-w-[8.4375rem]')}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className={cn(buttonClass, accent.bg, 'min-w-[11.5625rem]')}
            >
              {NEXT_LABEL[step]}
            </button>
          </div>
        </form>
      </BxCard>
      <UnsavedChangesDialog guard={guard} />
    </BenefitsFormPage>
  )
}
