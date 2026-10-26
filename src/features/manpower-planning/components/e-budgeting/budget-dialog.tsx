import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { cn } from '@/lib/utils'

import { useManpowerLookups, useSaveBudget } from '../../hooks/use-manpower'
import { budgetFormSchema, type BudgetFormValues } from '../../schemas/dialog-forms.schema'
import type { Budget } from '../../types/manpower.types'
import { showSaveError } from '../../utils/errors'
import { toAmount } from '../../utils/plan-math'
import { DateBox, MpField, MpSelect } from '../shared/controls'
import { accent, dialogBoxClass, dialogButton } from '../shared/mp-styles'
import { MpDialog } from '../shared/popups'

const FIELDS = [
  'title',
  'budgetDurationId',
  'jobTitleId',
  'departmentId',
  'amount',
  'totalPositions',
  'startDate',
  'endDate',
] as const

const optionsOf = (list: readonly { id: string; name: string }[]) =>
  list.map((item) => ({ value: item.id, label: item.name }))

/**
 * Add Budget and Edit Budget (not drawn; laid out as Add Budget Duration): a budget by hand,
 * or the amount, positions and dates of one that waits or was rejected. Saving a rejected
 * budget sends it back for approval. A plan's budget keeps its plan year and position.
 */
export function BudgetDialog({ budget, onClose }: { budget: Budget | null; onClose: () => void }) {
  const save = useSaveBudget()
  const lookups = useManpowerLookups()
  const fromPlan = Boolean(budget?.manpowerPlanId)
  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: budget
      ? {
          title: budget.title,
          budgetDurationId: budget.budgetDurationId,
          jobTitleId: budget.jobTitleId ?? '',
          departmentId: budget.departmentId ?? '',
          amount: String(budget.amount),
          totalPositions: String(budget.totalPositions),
          startDate: budget.startDate,
          endDate: budget.endDate,
        }
      : {
          title: '',
          budgetDurationId: '',
          jobTitleId: '',
          departmentId: '',
          amount: '',
          totalPositions: '1',
          startDate: '',
          endDate: '',
        },
  })
  const { control, register, handleSubmit, formState, setError } = form
  const durationId = useWatch({ control, name: 'budgetDurationId' })
  const duration = lookups.data?.durations.find((item) => item.id === durationId)

  const submit = handleSubmit((values) => {
    save.mutate(
      {
        id: budget?.id,
        input: {
          title: values.title.trim() || null,
          budgetDurationId: values.budgetDurationId,
          jobTitleId: values.jobTitleId || null,
          departmentId: values.departmentId || null,
          amount: toAmount(values.amount),
          totalPositions: toAmount(values.totalPositions),
          startDate: values.startDate,
          endDate: values.endDate,
          ...(budget ? { rowVersion: budget.rowVersion } : {}),
        },
      },
      {
        onSuccess: onClose,
        onError: (error) => {
          showSaveError(error, setError, FIELDS, 'The budget could not be saved.')
        },
      },
    )
  })

  const select = (
    name: 'budgetDurationId' | 'jobTitleId' | 'departmentId',
    label: string,
    options: { value: string; label: string }[],
    required = false,
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <MpField
          label={label}
          required={required}
          layout="inline"
          error={fieldState.error?.message}
        >
          {(a11y) => (
            <MpSelect
              {...a11y}
              value={field.value}
              onChange={field.onChange}
              noneLabel={required ? undefined : 'None'}
              noneTone="placeholder"
              disabled={fromPlan}
              options={options}
              className={dialogBoxClass}
            />
          )}
        </MpField>
      )}
    />
  )

  return (
    <MpDialog title={budget ? 'Edit Budget' : 'Add Budget'} onClose={onClose}>
      <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-6">
        <MpField label="Title" layout="inline" error={formState.errors.title?.message}>
          {(a11y) => (
            <input
              {...a11y}
              {...register('title')}
              placeholder="The position title's name"
              disabled={fromPlan}
              className={cn(dialogBoxClass, 'w-full disabled:bg-muted/40')}
            />
          )}
        </MpField>
        {select(
          'budgetDurationId',
          'Budget Duration',
          (lookups.data?.durations ?? []).map((item) => ({ value: item.id, label: item.name })),
          true,
        )}
        {select('jobTitleId', 'Position Title', optionsOf(lookups.data?.jobTitles ?? []))}
        {select('departmentId', 'Department', optionsOf(lookups.data?.departments ?? []))}
        <MpField
          label="Budget Amount"
          required
          layout="inline"
          error={formState.errors.amount?.message}
        >
          {(a11y) => (
            <input
              {...a11y}
              {...register('amount')}
              inputMode="decimal"
              className={cn(dialogBoxClass, 'w-full')}
            />
          )}
        </MpField>
        <MpField
          label="Total Positions"
          required
          layout="inline"
          error={formState.errors.totalPositions?.message}
        >
          {(a11y) => (
            <input
              {...a11y}
              {...register('totalPositions')}
              inputMode="numeric"
              className={cn(dialogBoxClass, 'w-full')}
            />
          )}
        </MpField>
        <Controller
          control={control}
          name="startDate"
          render={({ field, fieldState }) => (
            <MpField label="Start Date" required layout="inline" error={fieldState.error?.message}>
              {(a11y) => (
                <DateBox
                  {...a11y}
                  value={field.value}
                  onChange={field.onChange}
                  minDate={duration?.startDate}
                  maxDate={duration?.endDate}
                  className={dialogBoxClass}
                />
              )}
            </MpField>
          )}
        />
        <Controller
          control={control}
          name="endDate"
          render={({ field, fieldState }) => (
            <MpField label="End Date" required layout="inline" error={fieldState.error?.message}>
              {(a11y) => (
                <DateBox
                  {...a11y}
                  value={field.value}
                  onChange={field.onChange}
                  minDate={duration?.startDate}
                  maxDate={duration?.endDate}
                  className={dialogBoxClass}
                />
              )}
            </MpField>
          )}
        />
        <button
          type="submit"
          disabled={save.isPending}
          className={cn(dialogButton, accent.bg, 'mt-2 w-[11.5625rem] justify-self-center')}
        >
          Save Budget
        </button>
      </form>
    </MpDialog>
  )
}
