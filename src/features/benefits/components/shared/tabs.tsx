import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

import { cn } from '@/lib/utils'

import { StepCheckIcon } from './benefit-icons'
import { mediumText, rule, ruleBg } from './benefit-styles'

/** One tab: 38px, 5px top corners, Poppins Medium 14 #000; current #EBEFF8, others outlined. */
const tabClass = cn(
  mediumText,
  'inline-flex h-[2.375rem] shrink-0 items-center justify-center gap-2 rounded-t-[5px] border px-3.5 whitespace-nowrap text-heading outline-none focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35 sm:px-4',
)

type BenefitsTabPath =
  | '/benefits/plan-years'
  | '/benefits/plans'
  | '/benefits/enrollment-windows'
  | '/benefits/employees'
  | '/benefits/files'

/**
 * The card's sub menu (Plan Years, Plans, Enrollment Windows, Employees (n), Files). The links
 * keep the "Showing:" plan year.
 */
export function SubMenuTabs({
  items,
  current,
  year,
}: {
  items: readonly { to: BenefitsTabPath; label: string }[]
  current: BenefitsTabPath
  year: string | undefined
}) {
  return (
    <nav aria-label="Benefits" className="min-w-0">
      <ul className="flex [scrollbar-width:thin] gap-3 overflow-x-auto px-4 sm:px-6">
        {items.map((item) => {
          const active = item.to === current
          return (
            <li key={item.to} className="shrink-0">
              <Link
                to={item.to}
                search={year ? { year } : {}}
                activeOptions={{ exact: true }}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  tabClass,
                  rule,
                  active ? cn(ruleBg, 'border-transparent') : 'bg-card hover:bg-[#EBEFF8]/40',
                )}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export interface StepItem<T extends string> {
  value: T
  label: string
}

/**
 * Wizard steps (Details / Plans / New Hires, Step 1 / Step 2, Plan Details …): a finished step is
 * #7469E8 with a white tick, the current one #EBEFF8, the rest outlined. Finished steps (and the
 * current one) can be opened again; `isDisabled` greys a step that cannot be opened at all.
 */
export function StepTabs<T extends string>({
  steps,
  current,
  done,
  onSelect,
  isDisabled,
  label,
  className,
  trailing,
}: {
  steps: readonly StepItem<T>[]
  current: T
  done: readonly T[]
  onSelect?: (step: T) => void
  isDisabled?: (step: T) => boolean
  label: string
  className?: string
  /** Something at the right end of the row ("Select All"). */
  trailing?: ReactNode
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-4 gap-y-2', className)}>
      <ol aria-label={label} className="flex min-w-0 [scrollbar-width:thin] gap-3 overflow-x-auto">
        {steps.map((step, index) => {
          const isDone = done.includes(step.value) && step.value !== current
          const isCurrent = step.value === current
          const disabled = isDisabled?.(step.value) ?? (!isDone && !isCurrent)
          return (
            <li key={step.value} className="shrink-0">
              <button
                type="button"
                aria-current={isCurrent ? 'step' : undefined}
                aria-disabled={disabled || undefined}
                title={isDisabled?.(step.value) ? 'This step is not available yet' : undefined}
                onClick={() => {
                  if (!disabled && onSelect) onSelect(step.value)
                }}
                className={cn(
                  tabClass,
                  rule,
                  isDone
                    ? 'border-transparent bg-[#7469E8] text-white dark:bg-[#7F75F0]'
                    : isCurrent
                      ? cn(ruleBg, 'border-transparent')
                      : 'bg-card',
                  disabled && !isCurrent && 'cursor-default',
                  isDisabled?.(step.value) && 'text-heading/45',
                )}
              >
                {isDone && <StepCheckIcon className="size-3.5" />}
                <span>{step.label}</span>
                <span className="sr-only">
                  {`${isDone ? ', done' : ''} (step ${String(index + 1)} of ${String(steps.length)})`}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      {trailing}
    </div>
  )
}

/** The 48px band under the steps with the step's hint, between #EBEFF8 rules. */
export function StepBand({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex min-h-12 items-center border-y px-4 py-2 sm:px-[1.625rem]',
        rule,
        className,
      )}
    >
      {children}
    </div>
  )
}
