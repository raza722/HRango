import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { FieldLayoutContext, TextareaField } from '@/components/form'
import { ApiError } from '@/lib/api-error'

import { useCancelOvertime, useOvertimeDetail } from '../../hooks/use-overtime'
import type { OvertimeApplication } from '../../types/overtime.types'
import { stampLabel } from '../../utils/overtime-format'
import { OvertimeDialog } from './overtime-parts'

const schema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Give the reason for cancellation')
    .max(4000, 'Keep it under 4000 characters'),
})

/**
 * Cancel on My Overtime (`POST /requests/overtime/{id}/cancel {reason, rowVersion}`): a pending
 * request is withdrawn at once; an approved one asks for a cancellation, which the approvers
 * decide. Reads the request first for its rowVersion and whether it may still be cancelled.
 */
export function OvertimeCancelDialog({
  application,
  onClose,
}: {
  application: OvertimeApplication
  onClose: () => void
}) {
  const formId = useId()
  const cancel = useCancelOvertime()
  const detail = useOvertimeDetail(application.id)
  const pending = application.status === 'pending'
  const refused = detail.data !== undefined && !detail.data.actions.includes('cancel')
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { reason: '' },
  })
  const submit = form.handleSubmit(async (values) => {
    if (!detail.data) return
    try {
      await cancel.mutateAsync({
        id: application.id,
        reason: values.reason.trim(),
        rowVersion: detail.data.rowVersion,
      })
    } catch (failure) {
      if (failure instanceof ApiError) {
        form.setError(failure.fieldErrors.reason ? 'reason' : 'root', {
          message: failure.fieldErrors.reason ?? failure.message,
        })
      }
      return
    }
    onClose()
  })

  return (
    <OvertimeDialog
      title={pending ? 'Withdraw Overtime Request' : 'Cancel Overtime'}
      onClose={onClose}
      formId={formId}
      submitLabel={pending ? 'Withdraw' : 'Request Cancellation'}
      pending={cancel.isPending || !detail.data || refused}
      error={form.formState.errors.root?.message ?? detail.error?.message}
      className="max-w-xl"
    >
      <FieldLayoutContext value="vertical">
        <form
          id={formId}
          noValidate
          onSubmit={(event) => void submit(event)}
          className="grid gap-4"
        >
          <p className="text-sm text-title">
            {application.code}: {stampLabel(application.date, application.startTime)} to{' '}
            {stampLabel(application.date, application.endTime)}.{' '}
            {pending
              ? 'Withdrawing takes it out of the approval flow at once.'
              : 'The approvers decide the cancellation; the approved minutes come off the time sheet once it is approved.'}
          </p>
          {refused && (
            <p role="alert" className="text-sm text-destructive">
              This request can no longer be cancelled.
            </p>
          )}
          <TextareaField
            control={form.control}
            name="reason"
            label="Reason for Cancellation"
            required
            rows={4}
            maxLength={4000}
          />
        </form>
      </FieldLayoutContext>
    </OvertimeDialog>
  )
}
