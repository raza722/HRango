import { type SyntheticEvent, useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format, parseISO } from 'date-fns'
import { z } from 'zod'

import { SelectField, TextareaField } from '@/components/form'
import { DateField, PayrollDialog } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'

import { RETURN_CONDITION_LABELS } from '../../constants'
import { useDeallocate } from '../../hooks/use-assets'
import { type Allocation, RETURN_CONDITIONS } from '../../types/assets.types'

const schema = z.object({
  deallocatedOn: z.string().min(1, 'Choose the deallocation date'),
  returnCondition: z.string(),
  remarks: z.string().trim().max(500, 'Keep it under 500 characters'),
})
type Values = z.infer<typeof schema>

const FIELDS = ['deallocatedOn', 'returnCondition', 'remarks'] as const

/**
 * "Asset Deallocate" (not drawn): the asset comes back from the person on a
 * date, with how it came back (Damaged marks the asset damaged) and remarks.
 */
export function DeallocateDialog({ row, onClose }: { row: Allocation; onClose: () => void }) {
  const formId = useId()
  const deallocate = useDeallocate()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      deallocatedOn: format(new Date(), 'yyyy-MM-dd'),
      returnCondition: '',
      remarks: '',
    },
  })

  const submit = form.handleSubmit(async (values) => {
    try {
      await deallocate.mutateAsync({
        id: row.id,
        input: {
          deallocatedOn: values.deallocatedOn,
          returnCondition:
            RETURN_CONDITIONS.find((item) => item === values.returnCondition) ?? null,
          remarks: values.remarks || null,
          rowVersion: row.rowVersion,
        },
      })
      onClose()
    } catch (error) {
      const field =
        error instanceof ApiError ? FIELDS.find((name) => error.fieldErrors[name]) : undefined
      if (error instanceof ApiError && field) {
        form.setError(field, { message: error.fieldErrors[field] })
      } else {
        form.setError('root', {
          message: error instanceof ApiError ? error.message : 'Could not deallocate the asset.',
        })
      }
    }
  })

  return (
    <PayrollDialog
      title="Asset Deallocate"
      onClose={onClose}
      formId={formId}
      pending={deallocate.isPending}
      error={form.formState.errors.root?.message}
      className="max-w-2xl"
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event: SyntheticEvent) => void submit(event)}
        className="grid gap-5"
      >
        <p className="font-inter text-sm text-field-value">
          {row.assetName}
          {row.identificationNo ? ` (${row.identificationNo})` : ''} back from{' '}
          {row.employeeName ?? 'the employee'}.
        </p>
        <DateField
          control={form.control}
          name="deallocatedOn"
          label="Deallocation Date"
          required
          minDate={parseISO(row.allocatedOn)}
          display="MMMM d, yyyy"
        />
        <SelectField
          control={form.control}
          name="returnCondition"
          label="Return Condition"
          placeholder="Select Condition"
          options={RETURN_CONDITIONS.map((value) => ({
            value,
            label: RETURN_CONDITION_LABELS[value],
          }))}
          clearable
        />
        <TextareaField control={form.control} name="remarks" label="Remarks" maxLength={500} />
      </form>
    </PayrollDialog>
  )
}
