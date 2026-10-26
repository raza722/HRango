import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'

import { SelectField, TextField } from '@/components/form'
import { PayrollDialog, SearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'

import {
  useAllLeaveTypes,
  useProcessAllotment,
  useProcessCarryForward,
} from '../../hooks/use-leaves'
import { balanceDays } from '../../utils/format'

const RUNS = {
  allotment: 'Allot leave for the year',
  carry: 'Carry forward to the next year',
} as const

const schema = z.object({
  run: z.enum(['allotment', 'carry']),
  fiscalYear: z
    .string()
    .trim()
    .refine(
      (value) => /^\d{4}$/.test(value) && Number(value) >= 2000 && Number(value) <= 2100,
      'Enter a year from 2000 to 2100',
    ),
  leaveTypeId: z.string().nullable(),
})
type Values = z.infer<typeof schema>

/**
 * "Allotment" on Leave Types (no frame; the backend's runs): allots each active Auto
 * Allotment type to the people its policies cover for a leave year
 * (`POST /leaves/allotment/process`, idempotent, earned balances topped up to today), or
 * carries the year's unused days into the next one (`POST /leaves/carry-forward/process`).
 * Without a run nobody has a balance to apply against.
 */
export function AllotmentDialog({ onClose }: { onClose: () => void }) {
  const formId = useId()
  const types = useAllLeaveTypes()
  const allot = useProcessAllotment()
  const carry = useProcessCarryForward()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      run: 'allotment',
      fiscalYear: String(new Date().getFullYear()),
      leaveTypeId: null,
    },
  })

  const submit = form.handleSubmit(async (values) => {
    const year = Number(values.fiscalYear)
    try {
      if (values.run === 'allotment') {
        const result = await allot.mutateAsync({
          fiscalYear: year,
          leaveTypeId: values.leaveTypeId,
        })
        toast.success(
          `Allotted ${String(result.allotted)} balance${result.allotted === 1 ? '' : 's'} and ${String(result.earned)} earned (${balanceDays(result.days)} days) for ${String(result.fiscalYear)}`,
        )
      } else {
        const result = await carry.mutateAsync({
          fromFiscalYear: year,
          leaveTypeId: values.leaveTypeId,
        })
        toast.success(
          `Carried ${balanceDays(result.days)} days for ${String(result.carried)} balance${result.carried === 1 ? '' : 's'} from ${String(result.fromFiscalYear)}`,
        )
      }
    } catch (failure) {
      if (failure instanceof ApiError) {
        const yearError = failure.fieldErrors.fiscalYear ?? failure.fieldErrors.fromFiscalYear
        if (yearError) form.setError('fiscalYear', { message: yearError })
        else form.setError('root', { message: failure.message })
      }
      return
    }
    onClose()
  })

  return (
    <PayrollDialog
      title="Allotment"
      onClose={onClose}
      formId={formId}
      saveLabel="Run"
      pending={allot.isPending || carry.isPending}
      error={form.formState.errors.root?.message}
      className="max-w-2xl"
    >
      <form id={formId} noValidate onSubmit={(event) => void submit(event)} className="grid gap-5">
        <SelectField
          control={form.control}
          name="run"
          label="Run"
          required
          options={(Object.keys(RUNS) as (keyof typeof RUNS)[]).map((value) => ({
            value,
            label: RUNS[value],
          }))}
        />
        <TextField
          control={form.control}
          name="fiscalYear"
          label="Leave Year"
          required
          inputMode="numeric"
          maxLength={4}
          description="The year the leave year starts in (the company's fiscal year)."
        />
        <SearchSelectField
          control={form.control}
          name="leaveTypeId"
          label="Leave Type"
          placeholder="Every leave type"
          options={(types.data?.data ?? []).map((type) => ({
            value: type.id,
            label: type.title,
            hint: type.shortCode,
          }))}
        />
      </form>
    </PayrollDialog>
  )
}
