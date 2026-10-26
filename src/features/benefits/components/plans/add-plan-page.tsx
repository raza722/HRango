import type { SyntheticEvent } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { getRouteApi, useNavigate } from '@tanstack/react-router'

import { UnsavedChangesDialog } from '@/components/feedback/unsaved-changes-dialog'
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { ATTACHMENT_ACCEPT, CARRIERS, categoryMeta } from '../../constants'
import { useCreatePlan } from '../../hooks/use-benefits'
import { planFormSchema, type PlanFormValues } from '../../schemas/benefits.schema'
import type { PlanCategory } from '../../types/benefits.types'
import {
  accent,
  boxClass,
  buttonClass,
  labelText,
  placeholderColor,
} from '../shared/benefit-styles'
import { BxSelect, DateBox, FieldRow } from '../shared/controls'
import { BenefitsFormPage, BxCard } from '../shared/page-frame'
import { StepTabs } from '../shared/tabs'

const routeApi = getRouteApi('/_app/benefits/plans/new')

type PlanStep = 'details' | 'coverage' | 'eligibility' | 'enrollment' | 'payroll'

const STEPS: readonly { value: PlanStep; label: string }[] = [
  { value: 'details', label: 'Plan Details' },
  { value: 'coverage', label: 'Coverage Options' },
  { value: 'eligibility', label: 'Eligibility & Cost' },
  { value: 'enrollment', label: 'Enrollment Details' },
  { value: 'payroll', label: 'Payroll deduction' },
]

const COLUMNS = '@lg:grid-cols-[7.9375rem_minmax(0,14.1875rem)]'

/** The Add Plan form for the category chosen in the Add New Plan menu. */
export function AddPlanPage() {
  const { category } = routeApi.useSearch()
  return <AddPlanForm key={category} category={category} />
}

/**
 * "Add Medical Plan" (the title follows the category): the five steps, of which only Plan
 * Details is designed, so Continue saves the plan and goes back to the list; the other steps are
 * shown but not available yet.
 */
function AddPlanForm({ category }: { category: PlanCategory }) {
  const navigate = useNavigate()
  const meta = categoryMeta(category)
  const create = useCreatePlan()
  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      category,
      name: '',
      planType: '',
      planTypeRef: '',
      carrier: '',
      startDate: '',
      endDate: '',
      description: '',
      attachment: null,
    },
  })
  const { errors } = form.formState
  const guard = useUnsavedChangesGuard(form.formState.isDirty && !create.isSuccess)
  const startDate = useWatch({ control: form.control, name: 'startDate' })

  const submit = form.handleSubmit(async (values) => {
    try {
      await create.mutateAsync({
        input: {
          category: values.category,
          name: values.name.trim(),
          planType: values.planType,
          planTypeRef: values.planTypeRef.trim(),
          carrier: values.carrier,
          startDate: values.startDate,
          endDate: values.endDate,
          description: values.description.trim() || null,
          status: 'active',
        },
        attachment: values.attachment,
      })
      guard.allowNextNavigation()
      await navigate({ to: '/benefits/plans' })
    } catch (error) {
      const fields = error instanceof ApiError ? Object.entries(error.fieldErrors) : []
      if (fields.length > 0) {
        for (const [name, message] of fields) {
          if (name in values) form.setError(name as keyof PlanFormValues, { message })
        }
      } else {
        form.setError('root', {
          message: error instanceof ApiError ? error.message : 'Could not add the plan.',
        })
      }
    }
  })

  return (
    <BenefitsFormPage>
      <BxCard title={`Add ${meta.title} Plan`}>
        <form
          noValidate
          onSubmit={(event: SyntheticEvent) => void submit(event)}
          className="flex flex-1 flex-col"
        >
          <StepTabs
            label="Add plan steps"
            steps={STEPS}
            current="details"
            done={[]}
            isDisabled={(step) => step !== 'details'}
            className="mt-[1.75rem] px-4 sm:px-6"
          />
          <div className="@container flex-1 px-4 pt-6 sm:px-6">
            <p className={labelText}>How will you explain this plan to your employees?</p>
            <div className="mt-6 grid gap-y-5 @3xl:grid-cols-[repeat(2,max-content)] @3xl:gap-x-[2.625rem] @3xl:gap-y-[1.375rem]">
              <FieldRow label="Plan Name" required columns={COLUMNS} error={errors.name?.message}>
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
              <Controller
                control={form.control}
                name="carrier"
                render={({ field, fieldState }) => (
                  <FieldRow
                    label="Carrier"
                    required
                    columns={COLUMNS}
                    error={fieldState.error?.message}
                  >
                    {(a11y) => (
                      <BxSelect
                        {...a11y}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select Carrier"
                        options={CARRIERS.map((name) => ({ value: name, label: name }))}
                      />
                    )}
                  </FieldRow>
                )}
              />
              <Controller
                control={form.control}
                name="planType"
                render={({ field, fieldState }) => (
                  <FieldRow
                    label="Plan Type"
                    required
                    columns={COLUMNS}
                    error={fieldState.error?.message}
                  >
                    {(a11y) => (
                      <BxSelect
                        {...a11y}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select Plan Type"
                        options={meta.planTypes.map((type) => ({ value: type, label: type }))}
                      />
                    )}
                  </FieldRow>
                )}
              />
              <FieldRow
                label="Plan Type ID"
                required
                columns={COLUMNS}
                error={errors.planTypeRef?.message}
              >
                {(a11y) => (
                  <input
                    {...a11y}
                    {...form.register('planTypeRef')}
                    placeholder="Enter Plan Type ID"
                    autoComplete="off"
                    className={boxClass}
                  />
                )}
              </FieldRow>
              <Controller
                control={form.control}
                name="startDate"
                render={({ field, fieldState }) => (
                  <FieldRow
                    label="Plan Starts"
                    required
                    columns={COLUMNS}
                    error={fieldState.error?.message}
                  >
                    {(a11y) => <DateBox {...a11y} value={field.value} onChange={field.onChange} />}
                  </FieldRow>
                )}
              />
              <Controller
                control={form.control}
                name="endDate"
                render={({ field, fieldState }) => (
                  <FieldRow
                    label="Plan Ends"
                    required
                    columns={COLUMNS}
                    error={fieldState.error?.message}
                  >
                    {(a11y) => (
                      <DateBox
                        {...a11y}
                        value={field.value}
                        onChange={field.onChange}
                        minDate={startDate || undefined}
                      />
                    )}
                  </FieldRow>
                )}
              />
              <Controller
                control={form.control}
                name="attachment"
                render={({ field, fieldState }) => (
                  <FieldRow
                    label="Attachment"
                    columns="@lg:grid-cols-[7.9375rem_minmax(0,23.1875rem)]"
                    error={fieldState.error?.message}
                    className="@3xl:col-span-2 @3xl:mt-1.5"
                  >
                    {(a11y) => (
                      <div className="flex min-w-0 gap-2.5">
                        <input
                          {...a11y}
                          type="file"
                          accept={ATTACHMENT_ACCEPT}
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            field.onChange(file ?? null)
                            void form.trigger('attachment')
                          }}
                          className="peer sr-only"
                        />
                        <span
                          className={cn(
                            boxClass,
                            'flex max-w-[14.1875rem] items-center truncate',
                            !field.value && placeholderColor,
                          )}
                        >
                          {field.value?.name ?? 'No File Chosen'}
                        </span>
                        <label
                          htmlFor={a11y.id}
                          className={cn(
                            buttonClass,
                            accent.outline,
                            'h-[2.4375rem] w-[8.375rem] shrink-0 cursor-pointer px-3 text-xs font-normal peer-focus-visible:ring-[3px] peer-focus-visible:ring-[#7469E8]/35',
                          )}
                        >
                          Choose File
                        </label>
                      </div>
                    )}
                  </FieldRow>
                )}
              />
              <FieldRow
                label="Description"
                columns="@lg:grid-cols-[7.9375rem_minmax(0,23.1875rem)]"
                error={errors.description?.message}
                className="@3xl:col-span-2"
              >
                {(a11y) => (
                  <textarea
                    {...a11y}
                    {...form.register('description')}
                    rows={4}
                    placeholder="How will you explain this plan to your employees?"
                    className={cn(boxClass, 'h-auto min-h-[6rem] resize-y py-2')}
                  />
                )}
              </FieldRow>
            </div>
            {errors.root?.message && (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {errors.root.message}
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-3.5 px-4 pt-8 sm:px-[1.1875rem]">
            <button
              type="button"
              onClick={() => {
                void navigate({ to: '/benefits/plans' })
              }}
              className={cn(buttonClass, accent.outline, 'min-w-[8rem]')}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className={cn(buttonClass, accent.bg, 'min-w-[8rem]')}
            >
              Continue
            </button>
          </div>
        </form>
      </BxCard>
      <UnsavedChangesDialog guard={guard} />
    </BenefitsFormPage>
  )
}
