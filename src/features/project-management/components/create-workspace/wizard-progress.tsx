import { cn } from '@/lib/utils'

import { StepCheckIcon } from './wizard-icons'
import { WIZARD_STEP_LABELS, WIZARD_STEPS, type WizardStep } from './wizard-state'

/**
 * The stepper (Group 1597883643): 37px circles 287px apart joined by 3.5px lines, labels Poppins
 * SemiBold 16 #262626 under them. Done steps are a filled purple circle with a white tick, the
 * current one a purple ring round a dot, later ones grey.
 */
export function WizardProgress({ step }: { step: WizardStep }) {
  const current = WIZARD_STEPS.indexOf(step)
  return (
    <ol aria-label="Progress" className="mx-auto grid w-full max-w-[53.8125rem] grid-cols-3">
      {WIZARD_STEPS.map((entry, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'next'
        return (
          <li
            key={entry}
            aria-current={state === 'current' ? 'step' : undefined}
            className="relative flex flex-col items-center gap-2 text-center sm:gap-[0.8125rem]"
          >
            {index > 0 && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-[1.0625rem] right-[calc(50%+1.15rem)] left-[calc(-50%+1.15rem)] h-[0.218rem]',
                  index <= current ? 'bg-[#7127EA]' : 'bg-[#D1D5DB]',
                )}
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                'relative flex size-[2.3125rem] items-center justify-center rounded-full',
                state === 'done' && 'bg-[#7127EA] text-white',
                state === 'current' && 'border-[2.3px] border-[#7127EA]',
                state === 'next' && 'border-[2.3px] border-[#9CA3AF]',
              )}
            >
              {state === 'done' ? (
                <StepCheckIcon className="h-[0.745rem] w-[0.985rem]" />
              ) : (
                <span
                  className={cn(
                    'size-[0.7225rem] rounded-full',
                    state === 'current' ? 'bg-[#7127EA]' : 'bg-[#D1D5DB]',
                  )}
                />
              )}
            </span>
            <span className="text-xs leading-tight font-semibold text-[#262626] sm:text-base sm:leading-6">
              {WIZARD_STEP_LABELS[entry]}
              {state === 'done' && <span className="sr-only"> (completed)</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
