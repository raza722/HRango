import { type SyntheticEvent, useId, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { useBenefitsLookups, useCreateEnrollmentWindow } from '../../hooks/use-benefits'
import {
  ENROLLMENT_STEP_ONE_FIELDS,
  enrollmentWindowFormSchema,
  type EnrollmentWindowFormValues,
} from '../../schemas/benefits.schema'
import {
  accent,
  boxClass,
  buttonClass,
  greyOutline,
  labelText,
  requiredMark,
  rule,
} from '../shared/benefit-styles'
import { BxSelect, DateBox, FieldError, FieldRow } from '../shared/controls'
import { CoveragePicker } from '../shared/coverage-picker'
import { BxDialog } from '../shared/dialogs'
import { LookupsGate } from '../shared/list-parts'
import { StepTabs } from '../shared/tabs'
import { EmployeeTransfer } from './employee-transfer'

type Step = 'one' | 'two'

const STEPS = [
  { value: 'one', label: 'Step 1' },
  { value: 'two', label: 'Step 2' },
] as const

const LEFT = '@lg:grid-cols-[11.4375rem_minmax(0,14.1875rem)] @lg:gap-x-3'
const RIGHT = '@lg:grid-cols-[12.9375rem_minmax(0,14.1875rem)]'

/**
 * New Open Enrollment Window (row menu → Open Enrollment, or Qualifying Life Event with its name
 * filled in). Step 1: Enrollment Name, Plan Year, when it becomes effective, the last day to
 * enrol and which plans; Next: Step 2. Step 2: who can enroll; Back, Cancel, Create Enrollment
 * Plan.
 */
export function OpenEnrollmentDialog({
  planYearId,
  initialName = '',
  onClose,
}: {
  planYearId: string
  initialName?: string
  onClose: () => void
}) {
  const lookups = useBenefitsLookups()
  const create = useCreateEnrollmentWindow()
  const [step, setStep] = useState<Step>('one')
  const planErrorId = useId()
  const peopleErrorId = useId()
  const form = useForm<EnrollmentWindowFormValues>({
    resolver: zodResolver(enrollmentWindowFormSchema),
    defaultValues: {
      name: initialName,
      planYearId,
      effectiveDate: '',
      enrollmentEndDate: '',
      planIds: [],
      employeeIds: [],
    },
  })
  const { errors } = form.formState
  const chosenYearId = useWatch({ control: form.control, name: 'planYearId' })
  const year = lookups.data?.planYears.find((item) => item.id === chosenYearId)
  const yearPlans = (lookups.data?.plans ?? []).filter((plan) => year?.planIds.includes(plan.id))

  const submit = form.handleSubmit(async (values) => {
    try {
      await create.mutateAsync({ ...values, name: values.name.trim() })
      onClose()
    } catch (error) {
      const fields = error instanceof ApiError ? Object.entries(error.fieldErrors) : []
      if (fields.length > 0) {
        for (const [name, message] of fields) {
          if (name in values) form.setError(name as keyof EnrollmentWindowFormValues, { message })
        }
        if (fields.some(([name]) => name !== 'employeeIds')) setStep('one')
      } else {
        form.setError('root', {
          message: error instanceof ApiError ? error.message : 'Could not create the window.',
        })
      }
    }
  })

  const next = async () => {
    const valid = await form.trigger([...ENROLLMENT_STEP_ONE_FIELDS], { shouldFocus: true })
    if (valid) setStep('two')
  }

  return (
    <BxDialog
      title="New Open Enrollment Window"
      description={
        step === 'one'
          ? 'The window’s name, plan year, dates and plans.'
          : 'The people who can enroll in this window.'
      }
      onClose={onClose}
      className="max-w-[61.4375rem]"
    >
      <form
        noValidate
        onSubmit={(event: SyntheticEvent) => {
          event.preventDefault()
          if (step === 'one') void next()
          else void submit()
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <StepTabs
          label="New Open Enrollment Window steps"
          steps={STEPS}
          current={step}
          done={step === 'two' ? ['one'] : []}
          onSelect={setStep}
          className="mt-4 justify-center px-4 sm:mt-[1.4rem]"
        />
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 sm:px-[1.5625rem] sm:pb-[1.1rem]">
          <div
            className={cn(
              '@container rounded-[6px] border px-4 pt-5 pb-4 sm:px-[1.1875rem] sm:pt-7',
              rule,
            )}
          >
            {step === 'one' ? (
              <div className="grid gap-5">
                <div className="grid gap-y-5 @3xl:grid-cols-2 @3xl:gap-x-[1.4rem] @3xl:gap-y-3">
                  <FieldRow
                    label="Enrollment Name"
                    required
                    columns={LEFT}
                    error={errors.name?.message}
                  >
                    {(a11y) => (
                      <input
                        {...a11y}
                        {...form.register('name')}
                        placeholder="Enter Enrollment Name"
                        autoComplete="off"
                        className={boxClass}
                      />
                    )}
                  </FieldRow>
                  <Controller
                    control={form.control}
                    name="planYearId"
                    render={({ field, fieldState }) => (
                      <FieldRow
                        label="Plan Year"
                        required
                        columns={RIGHT}
                        error={fieldState.error?.message}
                      >
                        {(a11y) => (
                          <BxSelect
                            {...a11y}
                            value={field.value}
                            placeholder="Select Plan Year"
                            options={(lookups.data?.planYears ?? []).map((item) => ({
                              value: item.id,
                              label: item.name,
                            }))}
                            onChange={(value) => {
                              field.onChange(value)
                              const offered =
                                lookups.data?.planYears.find((item) => item.id === value)
                                  ?.planIds ?? []
                              form.setValue(
                                'planIds',
                                form.getValues('planIds').filter((id) => offered.includes(id)),
                              )
                            }}
                          />
                        )}
                      </FieldRow>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="effectiveDate"
                    render={({ field, fieldState }) => (
                      <FieldRow
                        label="When will this plan within this window become effective?"
                        required
                        columns={LEFT}
                        error={fieldState.error?.message}
                      >
                        {(a11y) => (
                          <DateBox
                            {...a11y}
                            value={field.value}
                            onChange={field.onChange}
                            minDate={year?.startDate}
                            maxDate={year?.endDate}
                          />
                        )}
                      </FieldRow>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="enrollmentEndDate"
                    render={({ field, fieldState }) => (
                      <FieldRow
                        label="When can employee complete their enrollment?"
                        required
                        columns={RIGHT}
                        error={fieldState.error?.message}
                      >
                        {(a11y) => (
                          <DateBox {...a11y} value={field.value} onChange={field.onChange} />
                        )}
                      </FieldRow>
                    )}
                  />
                </div>
                <Controller
                  control={form.control}
                  name="planIds"
                  render={({ field, fieldState }) => (
                    <fieldset className="grid gap-[1.1rem] @3xl:max-w-[46.5rem]">
                      <legend className={cn(labelText, 'mb-[1.1rem] @3xl:mt-2')}>
                        Which plans will be included in this year plan window
                        <span aria-hidden="true" className={requiredMark}>
                          *
                        </span>
                      </legend>
                      <LookupsGate query={lookups}>
                        {year ? (
                          <CoveragePicker
                            plans={yearPlans}
                            selected={field.value}
                            invalid={Boolean(fieldState.error)}
                            describedBy={fieldState.error ? planErrorId : undefined}
                            onChange={(value) => {
                              field.onChange(value)
                              if (fieldState.error) void form.trigger('planIds')
                            }}
                          />
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Choose the plan year first.
                          </p>
                        )}
                      </LookupsGate>
                      <FieldError id={planErrorId} message={fieldState.error?.message} />
                    </fieldset>
                  )}
                />
              </div>
            ) : (
              <div className="grid gap-5">
                <p className={labelText}>Who can enroll during this plan year window?</p>
                <Controller
                  control={form.control}
                  name="employeeIds"
                  render={({ field, fieldState }) => (
                    <div className="grid gap-2 @3xl:px-[3.3rem]">
                      <LookupsGate query={lookups}>
                        <EmployeeTransfer
                          employees={lookups.data?.employees ?? []}
                          departments={lookups.data?.departments ?? []}
                          value={field.value}
                          invalid={Boolean(fieldState.error)}
                          onChange={(value) => {
                            field.onChange(value)
                            if (fieldState.error) void form.trigger('employeeIds')
                          }}
                        />
                      </LookupsGate>
                      <FieldError id={peopleErrorId} message={fieldState.error?.message} />
                    </div>
                  )}
                />
              </div>
            )}
            {errors.root?.message && (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {errors.root.message}
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-x-[1.0625rem] gap-y-3">
              {step === 'two' && (
                <button
                  type="button"
                  onClick={() => {
                    setStep('one')
                  }}
                  className={cn(buttonClass, greyOutline, 'min-w-[8.4375rem]')}
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className={cn(buttonClass, accent.outline, 'min-w-[8.4375rem]')}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={create.isPending}
                className={cn(
                  buttonClass,
                  accent.bg,
                  step === 'one' ? 'min-w-32' : 'min-w-[12.125rem]',
                )}
              >
                {step === 'one' ? 'Next: Step 2' : 'Create Enrollment Plan'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </BxDialog>
  )
}
