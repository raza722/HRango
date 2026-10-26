import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Spinner } from '@/components/feedback/spinner'
import { cn } from '@/lib/utils'

import { useAddSalaryRange, useSalaryRanges } from '../../hooks/use-manpower'
import {
  salaryRangeFormSchema,
  type SalaryRangeFormValues,
} from '../../schemas/dialog-forms.schema'
import type { EmployeePosition } from '../../types/manpower.types'
import { showSaveError } from '../../utils/errors'
import { formatAmount, formatDay } from '../../utils/format'
import { toAmount } from '../../utils/plan-math'
import { DateBox, MpField } from '../shared/controls'
import { accent, dialogBoxClass, dialogButton, headText } from '../shared/mp-styles'
import { MpDialog } from '../shared/popups'

/**
 * Salary Ranges (not drawn): an employee position's band over time, newest first, and a new
 * band from a date on. Plans price new positions with the band in force.
 */
export function SalaryRangesDialog({
  position,
  canEdit,
  onClose,
}: {
  position: EmployeePosition
  canEdit: boolean
  onClose: () => void
}) {
  const ranges = useSalaryRanges(position.id)
  const add = useAddSalaryRange()
  const form = useForm<SalaryRangeFormValues>({
    resolver: zodResolver(salaryRangeFormSchema),
    defaultValues: { effectiveDate: '', minSalary: '', maxSalary: '' },
  })
  const { control, register, handleSubmit, formState, setError, reset } = form
  const submit = handleSubmit((values) => {
    add.mutate(
      {
        positionId: position.id,
        input: {
          effectiveDate: values.effectiveDate,
          minSalary: toAmount(values.minSalary),
          maxSalary: toAmount(values.maxSalary),
        },
      },
      {
        onSuccess: () => {
          reset()
          void ranges.refetch()
        },
        onError: (error) => {
          showSaveError(
            error,
            setError,
            ['effectiveDate', 'minSalary', 'maxSalary'],
            'The salary range could not be saved.',
          )
        },
      },
    )
  })
  const rows = [...(ranges.data ?? [])].sort((a, b) =>
    b.effectiveDate.localeCompare(a.effectiveDate),
  )

  return (
    <MpDialog
      title={`Salary Ranges: ${position.jobTitleName} (${position.code})`}
      onClose={onClose}
      className="max-w-[40rem]"
    >
      <div className="grid gap-6">
        {ranges.isPending ? (
          <div className="flex justify-center py-6">
            <Spinner label="Loading the salary ranges" />
          </div>
        ) : ranges.isError ? (
          <p role="alert" className="text-sm text-destructive">
            The salary ranges could not be loaded.
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[#707070]">No salary ranges yet.</p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Salary ranges</caption>
            <thead>
              <tr className="border-y border-[#EBEFF8] dark:border-border">
                {['From', 'Minimum Salary', 'Maximum Salary', 'Added By'].map((head) => (
                  <th key={head} scope="col" className={cn('h-10 px-2 text-left', headText)}>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((range) => (
                <tr key={range.id}>
                  <td className="px-2 py-2 text-heading">{formatDay(range.effectiveDate)}</td>
                  <td className="px-2 py-2 text-heading">{formatAmount(range.minSalary)}</td>
                  <td className="px-2 py-2 text-heading">{formatAmount(range.maxSalary)}</td>
                  <td className="px-2 py-2 text-heading">{range.createdByName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {canEdit && (
          <form
            noValidate
            aria-label="New salary range"
            onSubmit={(event) => void submit(event)}
            className="grid gap-4"
          >
            <Controller
              control={control}
              name="effectiveDate"
              render={({ field, fieldState }) => (
                <MpField label="From" required layout="inline" error={fieldState.error?.message}>
                  {(a11y) => (
                    <DateBox
                      {...a11y}
                      value={field.value}
                      onChange={field.onChange}
                      className={dialogBoxClass}
                    />
                  )}
                </MpField>
              )}
            />
            <MpField
              label="Minimum Salary"
              required
              layout="inline"
              error={formState.errors.minSalary?.message}
            >
              {(a11y) => (
                <input
                  {...a11y}
                  {...register('minSalary')}
                  inputMode="decimal"
                  className={cn(dialogBoxClass, 'w-full')}
                />
              )}
            </MpField>
            <MpField
              label="Maximum Salary"
              required
              layout="inline"
              error={formState.errors.maxSalary?.message}
            >
              {(a11y) => (
                <input
                  {...a11y}
                  {...register('maxSalary')}
                  inputMode="decimal"
                  className={cn(dialogBoxClass, 'w-full')}
                />
              )}
            </MpField>
            <button
              type="submit"
              disabled={add.isPending}
              className={cn(dialogButton, accent.bg, 'w-[11.5625rem] justify-self-center')}
            >
              Add Range
            </button>
          </form>
        )}
      </div>
    </MpDialog>
  )
}
