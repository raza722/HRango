import { useId, useState } from 'react'

import { cn } from '@/lib/utils'

import { categoryMeta, COVERAGE_ORDER } from '../../constants'
import type { LookupPlan } from '../../types/benefits.types'
import { ChevronDownIcon } from './benefit-icons'
import { bodyText, rule, smallText } from './benefit-styles'
import { TickBox } from './controls'

/**
 * "Which plans will be offered …": a box per coverage (Medical Coverage, Life Coverage …) that
 * opens to its plans. The group's box ticks or clears all its plans; it shows ticked while any
 * of them is chosen, as drawn.
 */
export function CoveragePicker({
  plans,
  selected,
  onChange,
  invalid,
  describedBy,
  className,
}: {
  plans: readonly LookupPlan[]
  selected: readonly string[]
  onChange: (planIds: string[]) => void
  invalid?: boolean
  describedBy?: string | undefined
  className?: string
}) {
  const groups = COVERAGE_ORDER.map((category) => ({
    category,
    plans: plans.filter((plan) => plan.category === category),
  })).filter((group) => group.plans.length > 0)

  if (groups.length === 0) {
    return (
      <p className={cn(smallText, 'text-muted-foreground')}>There are no plans to offer yet.</p>
    )
  }

  return (
    <div
      role="group"
      aria-invalid={invalid ? true : undefined}
      aria-describedby={describedBy}
      className={cn('grid items-start gap-x-[0.9375rem] gap-y-3.5 @xl:grid-cols-2', className)}
    >
      {groups.map((group) => (
        <CoverageGroup
          key={group.category}
          label={categoryMeta(group.category).coverage}
          plans={group.plans}
          selected={selected}
          onChange={onChange}
        />
      ))}
    </div>
  )
}

function CoverageGroup({
  label,
  plans,
  selected,
  onChange,
}: {
  label: string
  plans: readonly LookupPlan[]
  selected: readonly string[]
  onChange: (planIds: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const ids = plans.map((plan) => plan.id)
  const chosen = ids.filter((planId) => selected.includes(planId)).length
  const state = chosen === 0 ? false : chosen === ids.length ? true : 'mixed'

  return (
    <div className={cn('rounded-[6px] border bg-card', rule)}>
      <div className={cn('flex items-center gap-1.5 pr-2 pl-2', open ? 'h-[2.5625rem]' : 'h-12')}>
        <TickBox
          checked={state}
          labelledBy={`${id}-label`}
          onChange={(checked) => {
            onChange(
              checked
                ? [...new Set([...selected, ...ids])]
                : selected.filter((planId) => !ids.includes(planId)),
            )
          }}
        />
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-plans`}
          onClick={() => {
            setOpen((value) => !value)
          }}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 self-stretch rounded-[4px] pl-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35"
        >
          <span id={`${id}-label`} className={cn(bodyText, 'truncate')}>
            {label}
          </span>
          <span className="sr-only">{`, ${String(chosen)} of ${String(ids.length)} chosen`}</span>
          <ChevronDownIcon
            className={cn(
              'mr-1.5 h-[0.38rem] w-[0.67rem] shrink-0 text-[#1C1B1F] transition-transform dark:text-heading',
              open && 'rotate-180',
            )}
          />
        </button>
      </div>
      {open && (
        <ul
          id={`${id}-plans`}
          className={cn('grid gap-[0.8rem] border-t px-[0.4375rem] pt-3 pb-4', rule)}
        >
          {plans.map((plan) => {
            const labelId = `${id}-${plan.id}`
            const checked = selected.includes(plan.id)
            return (
              <li key={plan.id} className="flex items-center gap-1.5">
                <TickBox
                  checked={checked}
                  labelledBy={labelId}
                  onChange={(next) => {
                    onChange(
                      next
                        ? [...selected, plan.id]
                        : selected.filter((planId) => planId !== plan.id),
                    )
                  }}
                />
                <span id={labelId} className={smallText}>
                  {plan.name}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
