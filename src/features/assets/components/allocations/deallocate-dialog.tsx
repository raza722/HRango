import { type SyntheticEvent, useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format, parseISO } from 'date-fns'
import { z } from 'zod'

import { DateField, PayrollDialog } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'

import { useDeallocate } from '../../hooks/use-assets'
import type { AllocationRow } from '../../types/assets.types'

const schema = z.object({ deallocationDate: z.string().min(1, 'Choose the deallocation date') })
type Values = z.infer<typeof schema>

/**
 * "Asset Deallocate" (not drawn): the asset comes back from the person on a
 * date, and is free to allocate again.
 */
export function DeallocateDialog({ row, onClose }: { row: AllocationRow; onClose: () => void }) {
  const formId = useId()
  const deallocate = useDeallocate()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { deallocationDate: format(new Date(), 'yyyy-MM-dd') },
  })

  const submit = form.handleSubmit(async (values) => {
    try {
      await deallocate.mutateAsync({ id: row.id, deallocationDate: values.deallocationDate })
      onClose()
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.deallocationDate) {
        form.setError('deallocationDate', { message: error.fieldErrors.deallocationDate })
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
          {row.asset} ({row.identificationNumber}) back from {row.employee.name}.
        </p>
        <DateField
          control={form.control}
          name="deallocationDate"
          label="Deallocation Date"
          required
          minDate={parseISO(row.allocationDate)}
          display="MMMM d, yyyy"
        />
      </form>
    </PayrollDialog>
  )
}
