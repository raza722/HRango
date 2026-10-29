import { type SyntheticEvent, useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { addDays, format, parseISO } from 'date-fns'

import { FormField } from '@/components/form'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ConfirmAction,
  DateField,
  DateInput,
  PayrollDialog,
  SearchSelect,
} from '@/features/payroll'
import { ApiError } from '@/lib/api-error'

import { useEndOfEmployment, useRehire } from '../../hooks/use-offboarding'
import { makeRehireSchema, REHIRE_DATE, type RehireValues } from '../../schemas/rehire.schema'
import type { EndOfEmployment } from '../../types/offboarding.types'

const DATE = REHIRE_DATE
type Values = RehireValues

/**
 * "End of Employment Rehire": the person and their last working date (kept
 * as they were), and the new Joining Date. Save asks first, as drawn.
 */
export function RehireDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const record = useEndOfEmployment(id)
  if (!record.data) {
    return (
      <PayrollDialog title="End of Employment Rehire" onClose={onClose} readOnly>
        <Skeleton className="h-40 w-full" />
      </PayrollDialog>
    )
  }
  return <RehireForm record={record.data} onClose={onClose} />
}

function RehireForm({ record, onClose }: { record: EndOfEmployment; onClose: () => void }) {
  const formId = useId()
  const rehire = useRehire()
  const [confirming, setConfirming] = useState<string | null>(null)
  const last = record.lastWorkingDate
  const [today] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [schema] = useState(() => makeRehireSchema(last))
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { joiningDate: '' },
  })
  const name = record.employeeName ?? record.employeeCode ?? 'the employee'

  const submit = form.handleSubmit((values) => {
    setConfirming(values.joiningDate)
  })

  const confirm = () => {
    if (!confirming) return
    rehire.mutate(
      { record, joiningDate: confirming },
      {
        onSuccess: () => {
          onClose()
        },
        onError: (error) => {
          const message = error instanceof ApiError ? error.message : 'Could not rehire.'
          if (error instanceof ApiError && error.fieldErrors.joiningDate) {
            form.setError('joiningDate', { message: error.fieldErrors.joiningDate })
          } else {
            form.setError('root', { message })
          }
        },
      },
    )
  }

  return (
    <>
      <PayrollDialog
        title="End of Employment Rehire"
        // Figma draws this title larger: Inter Medium 26.
        titleClassName="sm:text-[1.625rem]"
        onClose={onClose}
        formId={formId}
        pending={rehire.isPending}
        error={form.formState.errors.root?.message}
        className="max-w-3xl"
      >
        <form
          id={formId}
          noValidate
          onSubmit={(event: SyntheticEvent) => void submit(event)}
          className="grid gap-5"
        >
          <FormField label="Employee">
            {(a11y) => (
              <SearchSelect
                {...a11y}
                value={record.employeeId}
                onChange={() => undefined}
                options={[{ value: record.employeeId, label: name }]}
                placeholder="Select Employee"
                disabled
                className="disabled:opacity-100"
              />
            )}
          </FormField>
          <FormField label="Last Working Date">
            {(a11y) => (
              <DateInput
                {...a11y}
                value={last}
                onChange={() => undefined}
                disabled
                display={DATE}
                className="disabled:opacity-100"
              />
            )}
          </FormField>
          <DateField
            control={form.control}
            name="joiningDate"
            label="Joining Date"
            required
            // Only a last day still to come limits the calendar (it would open on that month);
            // an earlier joining date is refused by the form either way.
            minDate={last >= today ? addDays(parseISO(last), 1) : undefined}
            display={DATE}
          />
        </form>
      </PayrollDialog>
      <ConfirmAction
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null)
        }}
        title={`Rehire ${name}`}
        message={`Rehire ${name}, joining on ${confirming ? format(parseISO(confirming), DATE) : ''}?`}
        onConfirm={confirm}
      />
    </>
  )
}
