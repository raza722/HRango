import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { cn } from '@/lib/utils'

import { useManpowerLookups, useUpdateBudget } from '../../hooks/use-manpower'
import { budgetFormSchema, type BudgetFormValues } from '../../schemas/dialog-forms.schema'
import type { BudgetRow } from '../../types/manpower.types'
import { showSaveError } from '../../utils/errors'
import { toAmount } from '../../utils/plan-math'
import { DateBox, MpField } from '../shared/controls'
import { accent, dialogBoxClass, dialogButton } from '../shared/mp-styles'
import { MpDialog } from '../shared/popups'

const readOnlyBox = cn(dialogBoxClass, 'flex w-full items-center bg-muted/40 text-sm sm:text-sm')

/**
 * Edit Budget (not drawn; laid out as Add Budget Duration): the amount and dates of a
 * budget that is waiting or was rejected. Saving sends it back for approval.
 */
export function BudgetDialog({ budget, onClose }: { budget: BudgetRow; onClose: () => void }) {
  const save = useUpdateBudget()
  const lookups = useManpowerLookups()
  const duration = lookups.data?.durations.find((item) => item.id === budget.durationId)
  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      amount: String(budget.amount),
      startDate: budget.startDate,
      endDate: budget.endDate,
    },
  })
  const { control, register, handleSubmit, formState, setError } = form
  const submit = handleSubmit((values) => {
    save.mutate(
      {
        id: budget.id,
        input: {
          amount: toAmount(values.amount),
          startDate: values.startDate,
          endDate: values.endDate,
        },
      },
      {
        onSuccess: onClose,
        onError: (error) => {
          showSaveError(
            error,
            setError,
            ['amount', 'startDate', 'endDate'],
            'The budget could not be saved.',
          )
        },
      },
    )
  })
  return (
    <MpDialog title="Edit Budget" onClose={onClose}>
      <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-6">
        <MpField label="Title" layout="inline">
          {(a11y) => (
            <output {...a11y} className={readOnlyBox}>
              {budget.title}
            </output>
          )}
        </MpField>
        <MpField label="Budget Duration" layout="inline">
          {(a11y) => (
            <output {...a11y} className={readOnlyBox}>
              {budget.duration}
            </output>
          )}
        </MpField>
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
