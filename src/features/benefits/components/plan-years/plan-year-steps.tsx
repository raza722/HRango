import { useId } from 'react'
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form'

import { cn } from '@/lib/utils'

import { ELECTION_UNITS, NEW_HIRE_OPTIONS, unitLabel } from '../../constants'
import type { PlanYearStep } from '../../hooks/use-plan-year-wizard'
import type { PlanYearFormValues } from '../../schemas/benefits.schema'
import type { LookupPlan } from '../../types/benefits.types'
import { CheckBoxIcon } from '../shared/benefit-icons'
import {
  accent,
  boxClass,
  labelText,
  largeBoxClass,
  mediumText,
  rule,
} from '../shared/benefit-styles'
import { BxSelect, DateBox, FieldError, FieldRow } from '../shared/controls'
import { CoveragePicker } from '../shared/coverage-picker'

type Form = UseFormReturn<PlanYearFormValues>

/** "(5 plans selected)" after a step's hint, in #7469E8. */
function SelectedCount({ form }: { form: Form }) {
  const planIds = useWatch({ control: form.control, name: 'planIds' })
  const count = planIds.length
  return (
    <span
      className={accent.text}
    >{` (${String(count)} ${count === 1 ? 'plan' : 'plans'} selected)`}</span>
  )
}

/**
 * The band under the steps. Details: "Fill the Form to proceed" on the page, "Plan Year Details"
 * in the dialog; Plans and New Hires: the question with the count of plans chosen.
 */
export function PlanYearStepHint({
  step,
  form,
  place,
}: {
  step: PlanYearStep
  form: Form
  place: 'page' | 'dialog'
}) {
  if (step === 'details') {
    return place === 'page' ? (
      <p className="text-sm leading-[1.3125rem] text-[#292929] dark:text-heading">
        Fill the Form to proceed
      </p>
    ) : (
      <p className={cn(mediumText, 'text-[#292929] dark:text-heading')}>Plan Year Details</p>
    )
  }
  return (
    <p className="text-xs leading-[1.125rem] text-[#292929] dark:text-heading">
      {step === 'plans'
        ? 'Which plans will be offered to employees this year?'
        : 'Whether employees start making elections on their first day or day 90, we’ve got you covered.'}
      <SelectedCount form={form} />
    </p>
  )
}

/** "Select All" at the right of the steps (Plans step). */
export function SelectAllPlans({ form, plans }: { form: Form; plans: readonly LookupPlan[] }) {
  const planIds = useWatch({ control: form.control, name: 'planIds' })
  const all = plans.length > 0 && plans.every((plan) => planIds.includes(plan.id))
  const id = useId()
  return (
    <div className="flex items-center gap-3 pb-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={all}
        aria-labelledby={id}
        onClick={() => {
          form.setValue('planIds', all ? [] : plans.map((plan) => plan.id), {
            shouldDirty: true,
            shouldValidate: form.formState.isSubmitted,
          })
        }}
        className={cn(
          'flex size-[1.125rem] items-center justify-center rounded-[3px] outline-none focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35',
          all ? accent.text : cn('border bg-card', rule),
        )}
      >
        {all && <CheckBoxIcon className="size-[1.125rem]" />}
      </button>
      <span id={id} className="text-sm leading-[1.3125rem] text-heading">
        Select All
      </span>
    </div>
  )
}

/**
 * Details: Plan Year Name, Plan Year Start, Plan Year End. The page sets the labels 161px wide,
 * the dialog 127px.
 */
export function DetailsStep({ form, place }: { form: Form; place: 'page' | 'dialog' }) {
  const { errors } = form.formState
  const columns =
    place === 'page'
      ? '@lg:grid-cols-[8.75rem_minmax(0,14.1875rem)] @lg:gap-x-[1.3rem]'
      : '@lg:grid-cols-[7.625rem_minmax(0,14.1875rem)] @lg:gap-x-[0.3125rem]'
  const startDate = useWatch({ control: form.control, name: 'startDate' })
  return (
    <div
      className={cn(
        'grid gap-y-5',
        place === 'page'
          ? '@3xl:grid-cols-[repeat(2,max-content)] @3xl:gap-x-[3.3rem] @3xl:gap-y-8'
          : '@2xl:grid-cols-[repeat(2,max-content)] @2xl:gap-x-[0.875rem] @2xl:gap-y-[1.375rem]',
      )}
    >
      <FieldRow label="Plan Year Name" required columns={columns} error={errors.name?.message}>
        {(a11y) => (
          <input
            {...a11y}
            {...form.register('name')}
            placeholder="Enter Plan Name"
            autoComplete="off"
            className={boxClass}
          />
        )}
      </FieldRow>
      <div
        aria-hidden="true"
        className={place === 'page' ? 'hidden @3xl:block' : 'hidden @2xl:block'}
      />
      <Controller
        control={form.control}
        name="startDate"
        render={({ field, fieldState }) => (
          <FieldRow
            label="Plan Year Start"
            required
            columns={columns}
            error={fieldState.error?.message}
          >
            {(a11y) => (
              <DateBox
                {...a11y}
                value={field.value}
                onChange={(value) => {
                  field.onChange(value)
                  if (form.formState.isSubmitted || errors.endDate) void form.trigger('endDate')
                }}
              />
            )}
          </FieldRow>
        )}
      />
      <Controller
        control={form.control}
        name="endDate"
        render={({ field, fieldState }) => (
          <FieldRow
            label="Plan Year End"
            required
            columns={
              place === 'page'
                ? '@lg:grid-cols-[6.5rem_minmax(0,14.1875rem)] @lg:gap-x-[1.3rem]'
                : columns
            }
            error={fieldState.error?.message}
          >
            {(a11y) => (
              <DateBox
                {...a11y}
                value={field.value}
                minDate={startDate || undefined}
                onChange={field.onChange}
              />
            )}
          </FieldRow>
        )}
      />
    </div>
  )
}

/** Plans: the coverage groups that open to their plans. */
export function PlansStep({ form, plans }: { form: Form; plans: readonly LookupPlan[] }) {
  const errorId = useId()
  return (
    <Controller
      control={form.control}
      name="planIds"
      render={({ field, fieldState }) => (
        <div className="grid gap-2">
          <CoveragePicker
            plans={plans}
            selected={field.value}
            invalid={Boolean(fieldState.error)}
            describedBy={fieldState.error ? errorId : undefined}
            onChange={(next) => {
              field.onChange(next)
              if (fieldState.error) void form.trigger('planIds')
            }}
          />
          <FieldError id={errorId} message={fieldState.error?.message} />
        </div>
      )}
    />
  )
}

/**
 * New Hires: "When can new hires start their benefits enrollment?" and "How long do new
 * employees have to complete elections?" (a number and its unit).
 */
export function NewHiresStep({ form }: { form: Form }) {
  const { errors } = form.formState
  const period = useWatch({ control: form.control, name: 'electionPeriod' })
  const start = useWatch({ control: form.control, name: 'newHireStart' })
  const count = Number(period) || 0
  const columns = '@lg:grid-cols-[13.625rem_minmax(0,22.8125rem)] @lg:gap-x-1.5'
  return (
    <div className="grid gap-[1.3rem]">
      <Controller
        control={form.control}
        name="newHireStart"
        render={({ field }) => (
          <FieldRow
            label="When can new hires start their benefits enrollment?"
            columns={columns}
            labelClassName={labelText}
          >
            {(a11y) => (
              <BxSelect
                {...a11y}
                value={field.value}
                onChange={field.onChange}
                options={NEW_HIRE_OPTIONS}
                className={largeBoxClass}
                contentClassName="w-[14.25rem] min-w-[14.25rem]"
              />
            )}
          </FieldRow>
        )}
      />
      {start === 'waiting_period' && (
        <FieldRow
          label="How many days is the waiting period?"
          required
          columns={columns}
          error={errors.waitingPeriodDays?.message}
        >
          {(a11y) => (
            <input
              {...a11y}
              {...form.register('waitingPeriodDays')}
              inputMode="numeric"
              autoComplete="off"
              placeholder="Days"
              className={cn(largeBoxClass, 'max-w-[9.875rem]')}
            />
          )}
        </FieldRow>
      )}
      <FieldRow
        label="How long do new employees have to complete elections?"
        columns={columns}
        error={errors.electionPeriod?.message}
      >
        {(a11y) => (
          <div className="grid grid-cols-[minmax(0,9.875rem)_minmax(0,12.5rem)] gap-[0.3125rem]">
            <input
              {...a11y}
              {...form.register('electionPeriod')}
              inputMode="numeric"
              autoComplete="off"
              className={largeBoxClass}
            />
            <Controller
              control={form.control}
              name="electionUnit"
              render={({ field }) => (
                <BxSelect
                  aria-label="Unit"
                  value={field.value}
                  onChange={field.onChange}
                  options={ELECTION_UNITS.map((unit) => ({
                    value: unit,
                    label: unitLabel(unit, count),
                  }))}
                  className={largeBoxClass}
                />
              )}
            />
          </div>
        )}
      </FieldRow>
    </div>
  )
}
